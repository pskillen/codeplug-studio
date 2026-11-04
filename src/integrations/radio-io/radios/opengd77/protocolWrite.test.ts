/**
 * OpenGD77 flash-write failure behaviour against a firmware-faithful fake radio (#1537):
 * firmware ACK/NACK framing, typed errors with context, stale-byte drain, one SHOW_CPS per session,
 * reboot-only recovery, and only in-span blocks on the wire.
 */

import { describe, expect, it } from 'vitest';
import {
  OPENGD77_WRITE_CMD_FINISH_SECTOR,
  OPENGD77_WRITE_CMD_SECTOR_BUFFER,
  OPENGD77_WRITE_CMD_SET_SECTOR,
} from '../../kit/codecs/opengd77Serial.ts';
import { RadioAbortedError, RadioProtocolError, RadioTimeoutError } from '../../kit/errors.ts';
import type { MemoryMap } from '../../types.ts';
import { OPENUV380_FLASH_SPANS } from './constants.ts';
import { createOpenUv380Image, writeAbs } from './memory.ts';
import { OpenGd77Protocol } from './protocol.ts';
import { SATELLITE_BANK_BYTES } from './satelliteCodec.ts';
import { OpenGd77ScriptedPipe } from './__fixtures__/scriptedPipe.ts';
import {
  OpenGd77WriteDesyncError,
  OpenGd77WriteNackError,
  OpenGd77WriteTimeoutError,
  OpenGd77WriteVerifyError,
} from './writeErrors.ts';

const SET = OPENGD77_WRITE_CMD_SET_SECTOR;
const BUF = OPENGD77_WRITE_CMD_SECTOR_BUFFER;
const FIN = OPENGD77_WRITE_CMD_FINISH_SECTOR;

/** Dirties sectors 0x0000, 0x20000 and 0x9b000. */
function threeSectorImage(): MemoryMap {
  const next = createOpenUv380Image();
  writeAbs(next, 0x80, new Uint8Array([0x01]));
  writeAbs(next, 0x20000, new Uint8Array([0x02]));
  writeAbs(next, 0x9b000, new Uint8Array([0x03]));
  return next;
}

async function connected(pipe = new OpenGd77ScriptedPipe(0x08)) {
  const proto = new OpenGd77Protocol();
  await proto.connect(pipe, { settleScale: 0 });
  return { pipe, proto };
}

function addr(frame: Uint8Array): number {
  return ((frame[2]! << 24) | (frame[3]! << 16) | (frame[4]! << 8) | frame[5]!) >>> 0;
}

/** SET_SECTOR frames sent for one sector. */
function setsFor(pipe: OpenGd77ScriptedPipe, sectorAbs: number): number {
  return pipe
    .writesOf(SET)
    .filter((w) => ((w[2]! << 16) | (w[3]! << 8) | w[4]!) * 4096 === sectorAbs).length;
}

async function failure(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (err) {
    return err as Error;
  }
  throw new Error('expected the write to fail');
}

const UDB_CONTACT = {
  wireName: 'N0CALL',
  digitalId: 1234567,
  callsign: 'N0CALL',
  city: 'Town',
  province: 'Shire',
  country: 'UK',
  remark: '',
};

describe('OpenGD77 write NACK handling', () => {
  it('a one-byte NACK on SET_SECTOR is a typed error naming the sector, and nothing more is written', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(SET, 2, 'nack', 99);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    expect(err).toBeInstanceOf(OpenGd77WriteNackError);
    const ctx = (err as OpenGd77WriteNackError).context;
    expect(ctx).toMatchObject({
      command: 'set-sector',
      sectorAbs: 0x20000,
      sectorIndex: 2,
      sectorsTotal: 3,
      phase: 'codeplug',
    });
    expect(err.message).toContain(
      "OpenGD77 refused SET_SECTOR for FLASH sector 0x20000 (sector 2 of 3): radio answered '-'",
    );
    expect(err.message).toContain('Gave up after 3 attempts');
    expect(setsFor(pipe, 0x9b000)).toBe(0);
    expect(pipe.writesOf(FIN)).toHaveLength(1);
  });

  it('a NACK on a mid-sector SECTOR_BUFFER names the block and stops before FINISH', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(BUF, 5, 'nack', 99);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    expect(err).toBeInstanceOf(OpenGd77WriteNackError);
    const ctx = (err as OpenGd77WriteNackError).context;
    const last = pipe.writesOf(BUF).at(-1)!;
    expect(ctx.command).toBe('sector-buffer');
    expect(ctx.sectorAbs).toBe(0);
    expect(ctx.offset).toBe(addr(last));
    expect(err.message).toMatch(
      /refused SECTOR_BUFFER for FLASH sector 0x0 at \+0x[0-9a-f]+ \(sector 1 of 3\)/,
    );
    // Five blocks, then the first block of each of the two restarts.
    expect(pipe.writesOf(BUF)).toHaveLength(7);
    expect(pipe.writesOf(FIN)).toHaveLength(0);
  });

  it('a NACK on FINISH names the sector and stops before the next SET_SECTOR', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(FIN, 3, 'nack', 99);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    expect(err).toBeInstanceOf(OpenGd77WriteNackError);
    expect((err as OpenGd77WriteNackError).context).toMatchObject({
      command: 'finish',
      sectorAbs: 0x9b000,
      sectorIndex: 3,
      sectorsTotal: 3,
    });
    expect(err.message).toContain(
      "OpenGD77 refused FINISH for FLASH sector 0x9b000 (sector 3 of 3): radio answered '-'",
    );
    expect(pipe.writesOf(SET)).toHaveLength(5);
    expect(setsFor(pipe, 0x9b000)).toBe(3);
  });

  it("'-' followed by the X 01 ACK in one chunk is a NACK, never success: nothing is sent on it, the sector restarts", async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(SET, 1, 'nack-then-ack');
    await proto.upload(threeSectorImage(), {});
    const sets = pipe.writes
      .map((w, i) => (w[0] === 0x58 && w[1] === SET ? i : -1))
      .filter((i) => i >= 0);
    const firstBuf = pipe.writes.findIndex((w) => w[0] === 0x58 && w[1] === BUF);
    expect(sets.length).toBeGreaterThanOrEqual(2);
    expect(firstBuf).toBeGreaterThan(sets[1]!);
    expect(pipe.writesOf(FIN)).toHaveLength(3);
  });

  it('an unexpected two-byte reply is a desync error', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(BUF, 1, 'wrong-echo', 99);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    expect(err).toBeInstanceOf(OpenGd77WriteDesyncError);
    expect(err).toBeInstanceOf(RadioProtocolError);
    expect(err.message).toContain('58 7f');
    expect(pipe.writesOf(BUF)).toHaveLength(3);
  });

  it('no reply is a timeout that still names the command and sector', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(FIN, 1, 'silent', 99);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    expect(err).toBeInstanceOf(OpenGd77WriteTimeoutError);
    expect(err).toBeInstanceOf(RadioTimeoutError);
    expect(err.message).toContain('FINISH for FLASH sector 0x0 (sector 1 of 3)');
  });

  it('a sector left open by an earlier interrupted write refuses the first SET_SECTOR; the restart closes it and the write completes', async () => {
    const { pipe, proto } = await connected();
    pipe.openSector = 0x1000;
    await proto.upload(threeSectorImage(), {});
    expect(setsFor(pipe, 0)).toBe(2);
    expect(pipe.writesOf(FIN)).toHaveLength(3);
    expect(pipe.flashByte(0x80)).toBe(0x01);
  });
});

describe('OpenGD77 stale bytes before a sector', () => {
  /** Put bytes on the line right after the pre-write read finishes. */
  function injectAfterPreWriteRead(pipe: OpenGd77ScriptedPipe, bytes: Uint8Array) {
    let done = false;
    return (update: { stage?: string; cur: number; max: number }) => {
      if (!done && update.stage === 'Pre-write read' && update.cur === update.max) {
        done = true;
        pipe.injectStale(bytes);
      }
    };
  }

  it('a stale - before a sector restarts that sector instead of passing for an ACK, and the write completes', async () => {
    const { pipe, proto } = await connected();
    await proto.upload(threeSectorImage(), {
      onProgress: injectAfterPreWriteRead(pipe, new Uint8Array([0x2d])),
    });
    expect(pipe.writesOf(FIN)).toHaveLength(3);
    expect(pipe.controls).toEqual([0]);
  });

  it('records the stale bytes and the restart in the trace when the sector then fails', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(BUF, 1, 'nack', 99);
    const err = await failure(() =>
      proto.upload(threeSectorImage(), {
        onProgress: injectAfterPreWriteRead(pipe, new Uint8Array([0x2d, 0x52])),
      }),
    );
    const trace = (err as RadioProtocolError).debugText!;
    expect(trace).toMatch(/STALE\s+2d 52/);
    expect(trace).toMatch(/NOTE\s+sector 0x0 attempt 2: .*2 unexpected byte\(s\).*2d 52/);
  });
});

describe('OpenGD77 stale bytes before a command', () => {
  it("a stale '-' is drained, so a command whose own reply never comes times out instead of succeeding", async () => {
    const { pipe, proto } = await connected();
    // The first control-6 command of a User Database write is the red-LED command.
    pipe.silenceCommand(0x06, 1);
    pipe.injectStale(new Uint8Array([0x2d]));
    const err = await failure(() => proto.uploadUserDatabase([UDB_CONTACT], {}));
    expect(err).toBeInstanceOf(RadioTimeoutError);
    expect(pipe.writesOf(SET)).toHaveLength(0);
    expect((err as RadioTimeoutError).debugText).toMatch(/STALE\s+2d/);
  });
});

describe('OpenGD77 frame trace', () => {
  it('attaches at most the last 24 frames to a protocol error as debugText', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(BUF, 40, 'nack', 99);
    const err = (await failure(() => proto.upload(threeSectorImage(), {}))) as RadioProtocolError;
    const lines = err.debugText!.split('\n');
    expect(lines[0]).toBe('Last 24 radio frames (oldest first):');
    expect(lines).toHaveLength(25);
    expect(err.debugText).toMatch(/TX\s+@\d+ 58 02/);
    expect(err.debugText).toMatch(/RX\s+2d/);
    // The recovery frame is recorded too.
    expect(err.debugText).toMatch(/NOTE\s+sent reboot-only/);
    // The message stays the plain sentence; the trace is separate.
    expect(err.message).not.toContain('radio frames');
  });
});

describe('OpenGD77 CPS screen is entered once per session', () => {
  it('a codeplug Write after a read-handshake connect sends SHOW_CPS exactly once', async () => {
    const { pipe, proto } = await connected();
    await proto.upload(threeSectorImage(), {});
    expect(pipe.commands.filter((c) => c[0] === 0x00)).toHaveLength(1);
  });

  it('a codeplug Write with User Database still sends SHOW_CPS once', async () => {
    const { pipe, proto } = await connected();
    proto.armWriteProjection([], { zones: [], userDatabaseContacts: [UDB_CONTACT] });
    await proto.upload(createOpenUv380Image(), {});
    expect(pipe.commands.filter((c) => c[0] === 0x00)).toHaveLength(1);
    // Success saves and reboots, which clears the CPS screen.
    expect(pipe.rebooted).toBe(true);
    expect(pipe.cpsDepth).toBe(0);
  });

  it('User Database only and keps-only writes send SHOW_CPS once after a read connect', async () => {
    const udb = await connected();
    await udb.proto.uploadUserDatabase([UDB_CONTACT], {});
    expect(udb.pipe.commands.filter((c) => c[0] === 0x00)).toHaveLength(1);

    const keps = await connected();
    await keps.proto.uploadSatelliteBank(new Uint8Array(SATELLITE_BANK_BYTES), {});
    expect(keps.pipe.commands.filter((c) => c[0] === 0x00)).toHaveLength(1);
    expect(keps.pipe.writesOf(SET).length).toBeGreaterThan(0);
  });

  it('a write-only connect (no handshake) enters CPS once', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe, { handshake: 'none' });
    await proto.upload(createOpenUv380Image(), {});
    expect(pipe.commands.filter((c) => c[0] === 0x00)).toHaveLength(1);
  });

  it('a read-only session closes the CPS screen exactly once', async () => {
    const { pipe, proto } = await connected();
    await proto.download({});
    await proto.disconnect();
    expect(pipe.commands.filter((c) => c[0] === 0x05)).toHaveLength(1);
    expect(pipe.cpsDepth).toBe(0);
  });

  it('a successful Write does not send CLOSE_CPS after the save-and-reboot', async () => {
    const { pipe, proto } = await connected();
    await proto.upload(threeSectorImage(), {});
    await proto.disconnect();
    expect(pipe.controls).toEqual([0]);
    expect(pipe.commands.filter((c) => c[0] === 0x05)).toHaveLength(0);
  });
});

describe('OpenGD77 recovery on failure', () => {
  it('a failure after the first sector began sends reboot-only C 06 01, never C 06 00', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(SET, 2, 'nack', 99);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    await proto.disconnect();
    expect(pipe.controls).toEqual([1]);
    expect(pipe.rebooted).toBe(true);
    expect(pipe.commands.filter((c) => c[0] === 0x05)).toHaveLength(0);
    expect(pipe.cpsDepth).toBe(0);
    expect(err.message).toContain('restart command');
  });

  it('records the reply to reboot-only in the trace and says in the error that it may not have taken', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(SET, 2, 'nack', 99);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    expect((err as RadioProtocolError).debugText).toMatch(/NOTE\s+sent reboot-only.*reply 2d/);
    expect(err.message).toContain('may still be on the CPS screen');
  });

  it('a silent radio after reboot-only is recorded and the original error still surfaces', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(SET, 2, 'nack', 99);
    pipe.silenceCommand(0x06, 1);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    expect(err).toBeInstanceOf(OpenGd77WriteNackError);
    expect((err as RadioProtocolError).debugText).toMatch(/NOTE\s+sent reboot-only.*no reply/);
  });

  it('a failure before any sector began sends a single CLOSE_CPS and no reboot', async () => {
    const { pipe, proto } = await connected();
    const abort = new AbortController();
    abort.abort();
    const err = await failure(() => proto.upload(threeSectorImage(), { signal: abort.signal }));
    await proto.disconnect();
    expect(err).toBeInstanceOf(RadioAbortedError);
    expect(pipe.commands.filter((c) => c[0] === 0x05)).toHaveLength(1);
    expect(pipe.controls).toEqual([]);
    expect(pipe.cpsDepth).toBe(0);
    expect(pipe.writesOf(SET)).toHaveLength(0);
  });

  it('an abort between sectors counts as programming started: reboot-only', async () => {
    const { pipe, proto } = await connected();
    const abort = new AbortController();
    const err = await failure(() =>
      proto.upload(threeSectorImage(), {
        signal: abort.signal,
        onProgress: (u) => {
          if (u.stage === 'FLASH sectors' && u.cur === 1) abort.abort();
        },
      }),
    );
    expect(err).toBeInstanceOf(RadioAbortedError);
    expect(pipe.controls).toEqual([1]);
    expect(pipe.writesOf(SET)).toHaveLength(1);
  });
});

describe('OpenGD77 recovery in the other write phases', () => {
  /** A failed phase reboots once (reboot-only), never saves, never closes CPS, entered CPS once. */
  function expectRebootOnly(pipe: OpenGd77ScriptedPipe) {
    expect(pipe.controls.filter((c) => c === 1)).toHaveLength(1);
    expect(pipe.controls).not.toContain(0);
    expect(pipe.commands.filter((c) => c[0] === 0x05)).toHaveLength(0);
    expect(pipe.commands.filter((c) => c[0] === 0x00)).toHaveLength(1);
    expect(pipe.rebooted).toBe(true);
  }

  it('a User Database failure sends reboot-only, not save-and-reboot', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(SET, 1, 'nack', 99);
    const err = await failure(() => proto.uploadUserDatabase([UDB_CONTACT], {}));
    expect((err as OpenGd77WriteNackError).context.phase).toBe('user-database');
    expectRebootOnly(pipe);
    expect(err.message).toContain('restart command');
  });

  it('a keps failure sends reboot-only, not save-and-reboot', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(SET, 1, 'nack', 99);
    const err = await failure(() =>
      proto.uploadSatelliteBank(new Uint8Array(SATELLITE_BANK_BYTES), {}),
    );
    expect(err).toBeInstanceOf(OpenGd77WriteNackError);
    expect((err as OpenGd77WriteNackError).context.phase).toBe('keps');
    expectRebootOnly(pipe);
  });
});

describe('OpenGD77 sends only blocks inside the registered spans', () => {
  it('sector 0x6000 and 0x7000: nothing at 0x6060-0x74ff, and bytes the radio owns survive', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    pipe.plantByte(0x6060, 0x5a); // first byte past span 0, where the radio keeps its own settings
    pipe.plantByte(0x6100, 0x42);
    pipe.plantByte(0x7010, 0x43);
    const { proto } = await connected(pipe);
    const next = createOpenUv380Image();
    writeAbs(next, 0x6000, new Uint8Array([0x11]));
    writeAbs(next, 0x7500, new Uint8Array([0x22]));
    await proto.upload(next, {});

    const sent = pipe.writesOf(BUF).map(addr);
    expect(sent.length).toBeGreaterThan(0);
    for (const a of sent) {
      const inSpan = OPENUV380_FLASH_SPANS.some(
        (s) => a >= s.start && a + 32 <= s.start + s.length,
      );
      expect(inSpan, `0x${a.toString(16)} is outside every span`).toBe(true);
    }
    expect(sent.some((a) => a >= 0x6060 && a < 0x7500)).toBe(false);
    expect(Math.max(...sent.filter((a) => a < 0x7000))).toBe(0x6040);
    expect(Math.min(...sent.filter((a) => a >= 0x7000))).toBe(0x7500);
    expect(pipe.flashByte(0x6060)).toBe(0x5a);
    expect(pipe.flashByte(0x6100)).toBe(0x42);
    expect(pipe.flashByte(0x7010)).toBe(0x43);
    expect(pipe.flashByte(0x6000)).toBe(0x11);
    expect(pipe.flashByte(0x7500)).toBe(0x22);
  });

  it('sector 0x0000 never sends below 0x80', async () => {
    const { pipe, proto } = await connected();
    await proto.upload(threeSectorImage(), {});
    const sent = pipe.writesOf(BUF).map(addr);
    expect(sent.filter((a) => a < 0x1000).every((a) => a >= 0x80)).toBe(true);
    expect(sent).toContain(0x80);
  });
});

describe('OpenGD77 sector recovery', () => {
  /** Frames sent by the host from the first SET_SECTOR on. */
  function afterFirstSet(pipe: OpenGd77ScriptedPipe): Uint8Array[] {
    const first = pipe.writes.findIndex((w) => w[0] === 0x58 && w[1] === SET);
    return pipe.writes.slice(first);
  }

  it('the happy path sends one read per block after FINISH and nothing else extra', async () => {
    const { pipe, proto } = await connected();
    await proto.upload(threeSectorImage(), {});
    const frames = afterFirstSet(pipe);
    const reads = frames.filter((w) => w[0] === 0x52);
    expect(pipe.writesOf(SET)).toHaveLength(3);
    expect(pipe.writesOf(FIN)).toHaveLength(3);
    expect(reads).toHaveLength(pipe.writesOf(BUF).length);
    const kinds = frames.map((w) => (w[0] === 0x52 ? 'R' : w[0] === 0x58 ? `X${w[1]}` : 'C'));
    const firstFin = kinds.indexOf(`X${FIN}`);
    expect(kinds[firstFin + 1]).toBe('R');
    expect(pipe.controls).toEqual([0]);
  });

  it('a split frame (stray - ahead of a real ACK, zeros in the buffer) restarts the sector and resends it whole', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(BUF, 3, 'split');
    await proto.upload(threeSectorImage(), {});
    const sectorBlocks = pipe
      .writesOf(BUF)
      .map(addr)
      .filter((a) => a < 0x1000);
    // The first three blocks, then every block again from the first.
    expect(sectorBlocks.indexOf(sectorBlocks[0]!, 1)).toBe(3);
    // The restart is SET (refused: closes the half-filled sector), then SET again.
    expect(setsFor(pipe, 0)).toBe(3);
    expect(pipe.flashByte(0x80)).toBe(0x01);
    expect(pipe.flashByte(0x20000)).toBe(0x02);
    expect(pipe.flashByte(0x9b000)).toBe(0x03);
    expect(pipe.writesOf(FIN)).toHaveLength(3);
    expect(pipe.controls).toEqual([0]);
  });

  it('data lost under a good ACK is caught by the read-back, never left in flash', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(BUF, 1, 'lose-data');
    await proto.upload(threeSectorImage(), {});
    expect(pipe.flashByte(0x80)).toBe(0x01);
    expect(pipe.writesOf(FIN)).toHaveLength(4);
  });

  it('a refused SET_SECTOR during recovery is handled: the refusal closes the sector, the next one opens it', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(SET, 1, 'nack', 2);
    await proto.upload(threeSectorImage(), {});
    expect(setsFor(pipe, 0)).toBe(3);
    expect(pipe.writesOf(FIN)).toHaveLength(3);
    expect(pipe.flashByte(0x80)).toBe(0x01);
  });

  it('a timeout restarts the sector too', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(BUF, 2, 'silent');
    await proto.upload(threeSectorImage(), {});
    expect(pipe.writesOf(FIN)).toHaveLength(3);
    expect(pipe.flashByte(0x80)).toBe(0x01);
  });

  it('three failed attempts fail with the typed error, say so, and show every retry in the trace', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(BUF, 1, 'nack', 3);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    expect(err).toBeInstanceOf(OpenGd77WriteNackError);
    expect(err.message).toContain('Gave up after 3 attempts');
    const trace = (err as RadioProtocolError).debugText!;
    expect(trace).toMatch(/NOTE\s+sector 0x0 attempt 2: /);
    expect(trace).toMatch(/NOTE\s+sector 0x0 attempt 3: /);
    expect(trace).toMatch(/NOTE\s+sent reboot-only/);
    expect(pipe.controls).toEqual([1]);
    expect(setsFor(pipe, 0)).toBe(3);
  });

  it('a read-back that keeps failing is a typed verify error after three attempts', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(BUF, 1, 'lose-data', 99999);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    expect(err).toBeInstanceOf(OpenGd77WriteVerifyError);
    expect(err.message).toContain('read-back of');
    expect(err.message).toContain('Gave up after 3 attempts');
    expect(pipe.writesOf(FIN)).toHaveLength(3);
  });
});

describe('OpenGD77 trace byte offsets', () => {
  it('each TX line carries the cumulative offset of its frame', async () => {
    const { pipe, proto } = await connected();
    pipe.nackOn(SET, 1, 'nack', 99);
    const err = await failure(() => proto.upload(threeSectorImage(), {}));
    const offsets = [...(err as RadioProtocolError).debugText!.matchAll(/TX\s+@(\d+) /g)].map((m) =>
      Number(m[1]),
    );
    expect(offsets.length).toBeGreaterThan(2);
    for (let i = 1; i < offsets.length; i++) expect(offsets[i]).toBeGreaterThan(offsets[i - 1]!);
  });
});

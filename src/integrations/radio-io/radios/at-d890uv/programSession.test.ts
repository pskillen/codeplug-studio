import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  AtD890ScriptedPipe,
  assertAtD890NoReadAfterWrite,
  localInfoWithSerial,
} from './__fixtures__/scriptedPipe.ts';
import {
  atD890ExitProgram,
  atD890ReadBlockRaw,
  atD890ReadMemory,
  atD890WriteMemory,
} from './connection.ts';
import { D890_MAP } from './constants.ts';
import { eraseUnitBaseFor } from './eraseUnits.ts';
import {
  AT_D890_UNKNOWN_RADIO,
  AtD890PendingUnitsError,
  clearAllAtD890PendingRecords,
  findAtD890PendingBlock,
  readAtD890PendingUnits,
  recordAtD890PendingUnits,
} from './pendingUnits.ts';
import {
  AtD890ReadAfterWriteError,
  declareAtD890PlannedUnits,
  gateAtD890Write,
  recordAtD890AbandonedSession,
  isAtD890WritePhase,
  listAtD890UnitsEntered,
  readAtD890ProgramCounters,
  getAtD890SessionSerial,
} from './programSession.ts';
import { allowLeakedD890MarkersInThisFile } from '../../../../test/leakedD890Marker.ts';

allowLeakedD890MarkersInThisFile();

const READ_AT = D890_MAP.ChannelSet;
const WRITE_AT = D890_MAP.ChannelSet + 0x10;

function pipeWithFfRadio(): AtD890ScriptedPipe {
  const pipe = new AtD890ScriptedPipe();
  pipe.readResponder = (_addr, len) => new Uint8Array(len).fill(0xff);
  pipe.autoAckWrites = true;
  return pipe;
}

const block = () => new Uint8Array(0x10).fill(0x11);

describe('AT-D890 program-session latch (#1406)', () => {
  it('allows reads before the first W', async () => {
    const pipe = pipeWithFfRadio();
    await atD890ReadMemory(pipe, READ_AT, 0x20);
    await atD890ReadMemory(pipe, READ_AT, 0x20);
    expect(isAtD890WritePhase(pipe)).toBe(false);
  });

  it('R, W, R: the second R throws and nothing more reaches the pipe', async () => {
    const pipe = pipeWithFfRadio();
    await atD890ReadMemory(pipe, READ_AT, 0x10);
    await atD890WriteMemory(pipe, WRITE_AT, block());
    const framesBefore = pipe.writes.length;
    const err = await atD890ReadMemory(pipe, READ_AT, 0x10).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AtD890ReadAfterWriteError);
    expect(err).toBeInstanceOf(RadioProtocolError);
    expect((err as AtD890ReadAfterWriteError).readAddress).toBe(READ_AT);
    expect((err as AtD890ReadAfterWriteError).firstWriteAddress).toBe(WRITE_AT);
    expect(pipe.writes).toHaveLength(framesBefore);
    assertAtD890NoReadAfterWrite(pipe.writes);
  });

  it('refuses the raw read and the 16-byte fallback read after a W, sending nothing', async () => {
    const pipe = pipeWithFfRadio();
    await atD890WriteMemory(pipe, WRITE_AT, block());
    const framesBefore = pipe.writes.length;
    await expect(atD890ReadBlockRaw(pipe, READ_AT, 0x10)).rejects.toBeInstanceOf(
      AtD890ReadAfterWriteError,
    );
    // A 0xf0-byte read would fall back to 16-byte reads on failure; both are refused, unsent.
    await expect(atD890ReadMemory(pipe, READ_AT, 0xf0, undefined, 0xf0)).rejects.toBeInstanceOf(
      AtD890ReadAfterWriteError,
    );
    expect(pipe.writes).toHaveLength(framesBefore);
  });

  it('END clears the latch; a new session may read again', async () => {
    const pipe = pipeWithFfRadio();
    await atD890WriteMemory(pipe, WRITE_AT, block());
    expect(isAtD890WritePhase(pipe)).toBe(true);
    await atD890ExitProgram(pipe);
    expect(isAtD890WritePhase(pipe)).toBe(false);
    await expect(atD890ReadMemory(pipe, READ_AT, 0x10)).resolves.toBeInstanceOf(Uint8Array);
    assertAtD890NoReadAfterWrite(pipe.writes);
  });

  it('a fresh PROGRAM without END does not clear it', async () => {
    const pipe = pipeWithFfRadio();
    await atD890WriteMemory(pipe, WRITE_AT, block());
    // An abandoned session leaves no END; the next PROGRAM on the same pipe is still refused.
    pipe.enqueue(new Uint8Array([0x51]), new Uint8Array([0x58, 0x06]));
    const { atD890EnterProgram } = await import('./connection.ts');
    await atD890EnterProgram(pipe);
    expect(isAtD890WritePhase(pipe)).toBe(true);
    await expect(atD890ReadMemory(pipe, READ_AT, 0x10)).rejects.toBeInstanceOf(
      AtD890ReadAfterWriteError,
    );
  });

  it('a new pipe starts clean', async () => {
    const a = pipeWithFfRadio();
    await atD890WriteMemory(a, WRITE_AT, block());
    const b = pipeWithFfRadio();
    expect(isAtD890WritePhase(b)).toBe(false);
    await expect(atD890ReadMemory(b, READ_AT, 0x10)).resolves.toBeInstanceOf(Uint8Array);
  });

  it('a W whose ACK times out still latches', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.pendingTimeouts = 5; // every attempt times out
    await expect(atD890WriteMemory(pipe, WRITE_AT, block())).rejects.toThrow();
    expect(isAtD890WritePhase(pipe)).toBe(true);
    pipe.readResponder = (_a, len) => new Uint8Array(len).fill(0xff);
    await expect(atD890ReadMemory(pipe, READ_AT, 0x10)).rejects.toBeInstanceOf(
      AtD890ReadAfterWriteError,
    );
  });

  it('counts R and W frames and the units a session entered', async () => {
    const pipe = pipeWithFfRadio();
    await atD890ReadMemory(pipe, READ_AT, 0x20);
    await atD890WriteMemory(pipe, WRITE_AT, new Uint8Array(0x30).fill(0x22));
    await atD890WriteMemory(pipe, 0x0360_0000, block());
    const c = readAtD890ProgramCounters(pipe);
    expect(c).toMatchObject({ rFrames: 2, rBytes: 0x20, wFrames: 4, wUnitsEntered: 2 });
    expect(listAtD890UnitsEntered(pipe)).toEqual([0x0348_0000, 0x0360_0000]);
    await atD890ExitProgram(pipe);
    expect(listAtD890UnitsEntered(pipe)).toEqual([]);
    // Counters are cumulative across END.
    expect(readAtD890ProgramCounters(pipe).wFrames).toBe(4);
  });
});

describe('AT-D890 abandoned sessions and the pending-units gate (#1406)', () => {
  // Writable addresses in three different erase units (the unit is the address's 0x40000 base).
  const A1 = D890_MAP.ChannelSet;
  const A2 = 0x0360_0000;
  const A3 = D890_MAP.TalkgroupSet;
  const U1 = eraseUnitBaseFor(A1);
  const U2 = eraseUnitBaseFor(A2);
  const U3 = eraseUnitBaseFor(A3);
  const addrOf = new Map([
    [U1, A1],
    [U2, A2],
    [U3, A3],
  ]);
  const SERIAL = 'SN-GATE-0000001';
  const OTHER = 'SN-OTHER-000001';

  beforeEach(() => clearAllAtD890PendingRecords());
  afterEach(() => clearAllAtD890PendingRecords());

  /** A radio whose LocalInfo carries `serial`; one read of it ties the pipe to that radio. */
  async function pipeFor(serial: string): Promise<AtD890ScriptedPipe> {
    const pipe = new AtD890ScriptedPipe();
    pipe.autoAckWrites = true;
    pipe.readResponder = (addr, len) => {
      const li = localInfoWithSerial(serial);
      const rel = addr - D890_MAP.LocalInfo;
      return rel >= 0 && rel + len <= li.length
        ? li.slice(rel, rel + len)
        : new Uint8Array(len).fill(0xff);
    };
    await atD890ReadMemory(pipe, D890_MAP.LocalInfo, D890_MAP.LocalInfoLength);
    return pipe;
  }

  async function writeUnits(pipe: AtD890ScriptedPipe, units: number[]) {
    for (const u of units) await atD890WriteMemory(pipe, addrOf.get(u)!, block());
  }

  it('a LocalInfo read ties the pipe to the radio serial', async () => {
    const pipe = await pipeFor(SERIAL);
    expect(getAtD890SessionSerial(pipe)).toBe(SERIAL);
    expect(getAtD890SessionSerial(pipeWithFfRadio())).toBe('');
  });

  it('records every unit but the one in progress, under this radio', async () => {
    const pipe = await pipeFor(SERIAL);
    await writeUnits(pipe, [U1, U2, U3]);
    expect(recordAtD890AbandonedSession(pipe)).toEqual([U1, U2]);
    expect(readAtD890PendingUnits(SERIAL)).toEqual([U1, U2]);
    expect(findAtD890PendingBlock(OTHER)).toBeNull();
  });

  it('records nothing when the session never left its first unit', async () => {
    const pipe = await pipeFor(SERIAL);
    await writeUnits(pipe, [U1]);
    expect(recordAtD890AbandonedSession(pipe)).toEqual([]);
    expect(findAtD890PendingBlock(SERIAL)).toBeNull();
  });

  it('an unreadable serial records under the unknown radio, which blocks every radio', async () => {
    const pipe = pipeWithFfRadio();
    await writeUnits(pipe, [U1, U2]);
    recordAtD890AbandonedSession(pipe);
    expect(readAtD890PendingUnits(AT_D890_UNKNOWN_RADIO)).toEqual([U1]);
    const other = await pipeFor(OTHER);
    expect(() => gateAtD890Write(other, [U1, U2, U3])).toThrow(AtD890PendingUnitsError);
  });

  it('the gate refuses a plan that misses a pending unit, and passes one that covers them', async () => {
    recordAtD890PendingUnits(SERIAL, [U1, U2]);
    const pipe = await pipeFor(SERIAL);
    expect(() => gateAtD890Write(pipe, [U1])).toThrow(AtD890PendingUnitsError);
    declareAtD890PlannedUnits(pipe, [U2]);
    expect(gateAtD890Write(pipe, [U1])).toEqual([U1, U2]);
  });

  it("another radio's record does not block this one", async () => {
    recordAtD890PendingUnits(OTHER, [U1, U2]);
    const pipe = await pipeFor(SERIAL);
    expect(gateAtD890Write(pipe, [U3])).toEqual([]);
  });

  it('with no gate call, the first W is refused while units are pending, sending nothing', async () => {
    recordAtD890PendingUnits(SERIAL, [U1]);
    const pipe = await pipeFor(SERIAL);
    const framesBefore = pipe.writes.length;
    await expect(atD890WriteMemory(pipe, A2, block())).rejects.toBeInstanceOf(
      AtD890PendingUnitsError,
    );
    expect(pipe.writes).toHaveLength(framesBefore);
  });

  it('a gated session that ends with END clears the units it wrote, and only those', async () => {
    recordAtD890PendingUnits(SERIAL, [U1, U2]);
    const pipe = await pipeFor(SERIAL);
    gateAtD890Write(pipe, [U1, U2, U3]);
    await writeUnits(pipe, [U1, U3]);
    await atD890ExitProgram(pipe);
    expect(readAtD890PendingUnits(SERIAL)).toEqual([U2]);
  });

  it('a second abandon adds to the record', async () => {
    recordAtD890PendingUnits(SERIAL, [U3]);
    const pipe = await pipeFor(SERIAL);
    gateAtD890Write(pipe, [U1, U2, U3]);
    await writeUnits(pipe, [U1, U2]);
    recordAtD890AbandonedSession(pipe);
    expect(readAtD890PendingUnits(SERIAL)).toEqual([U1, U3]);
  });

  describe('contact units beyond the new contact count (F276)', () => {
    const META = D890_MAP.DigitalContactMeta;
    const ORDER0 = 0x0708_0000;
    const DATA0 = D890_MAP.DigitalContactData;
    const DATA4 = D890_MAP.DigitalContactData + 4 * D890_MAP.DigitalContactDataStride;

    it('are satisfied when the header unit is rewritten, and cleared by END', async () => {
      recordAtD890PendingUnits(SERIAL, [META, DATA0, DATA4]);
      const pipe = await pipeFor(SERIAL);
      // New plan: header and the first data unit only (100 contacts).
      expect(gateAtD890Write(pipe, [META, DATA0])).toEqual([META, DATA0]);
      await atD890WriteMemory(pipe, META, block(), undefined, { transmitGuard: () => undefined });
      await atD890WriteMemory(pipe, DATA0, block(), undefined, { transmitGuard: () => undefined });
      await atD890ExitProgram(pipe);
      expect(findAtD890PendingBlock(SERIAL)).toBeNull();
    });

    it('stay pending when END comes from a session that never wrote the header', async () => {
      recordAtD890PendingUnits(SERIAL, [META, DATA0, DATA4]);
      const pipe = await pipeFor(SERIAL);
      gateAtD890Write(pipe, [META, DATA0]);
      await atD890ExitProgram(pipe);
      expect(readAtD890PendingUnits(SERIAL)).toEqual([META, DATA0, DATA4]);
    });

    it('are never waved through for a codeplug-only plan', async () => {
      recordAtD890PendingUnits(SERIAL, [DATA4]);
      const pipe = await pipeFor(SERIAL);
      expect(() => gateAtD890Write(pipe, [U1, U2])).toThrow(AtD890PendingUnitsError);
    });

    it('are not waved through when the header is not rewritten', async () => {
      recordAtD890PendingUnits(SERIAL, [ORDER0]);
      const pipe = await pipeFor(SERIAL);
      expect(() => gateAtD890Write(pipe, [DATA0])).toThrow(AtD890PendingUnitsError);
    });

    it('never relax a codeplug unit even when the header is rewritten', async () => {
      recordAtD890PendingUnits(SERIAL, [U1, DATA4]);
      const pipe = await pipeFor(SERIAL);
      expect(() => gateAtD890Write(pipe, [META, DATA0])).toThrow(AtD890PendingUnitsError);
    });
  });

  describe('a session cut off with no thrown error (in-progress marker)', () => {
    it('is recorded at the first W, the unit in progress included', async () => {
      const pipe = await pipeFor(SERIAL);
      await writeUnits(pipe, [U1, U2]);
      // The tab closes here: nothing ran abandon, nothing sent END.
      const pending = findAtD890PendingBlock(SERIAL)!;
      expect(pending.interrupted).toBe(true);
      expect(pending.units).toEqual([U1, U2]);
    });

    it('END clears it', async () => {
      const pipe = await pipeFor(SERIAL);
      await writeUnits(pipe, [U1, U2]);
      await atD890ExitProgram(pipe);
      expect(findAtD890PendingBlock(SERIAL)).toBeNull();
    });

    it('abandon replaces it with the finished units only', async () => {
      const pipe = await pipeFor(SERIAL);
      await writeUnits(pipe, [U1, U2]);
      recordAtD890AbandonedSession(pipe);
      const pending = findAtD890PendingBlock(SERIAL)!;
      expect(pending.interrupted).toBe(false);
      expect(pending.units).toEqual([U1]);
    });

    it('a surviving marker blocks the next session until it rewrites those units', async () => {
      const crashed = await pipeFor(SERIAL);
      await writeUnits(crashed, [U1, U2]);
      const next = await pipeFor(SERIAL);
      expect(() => gateAtD890Write(next, [U1])).toThrow(AtD890PendingUnitsError);
      expect(gateAtD890Write(next, [U1, U2])).toEqual([U1, U2]);
      await writeUnits(next, [U1, U2]);
      await atD890ExitProgram(next);
      expect(findAtD890PendingBlock(SERIAL)).toBeNull();
    });
  });
});

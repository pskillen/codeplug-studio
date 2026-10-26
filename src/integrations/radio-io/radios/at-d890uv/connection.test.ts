import { describe, expect, it } from 'vitest';
import { RadioProtocolError, RadioTimeoutError, RadioWrongIdentError } from '../../kit/errors.ts';
import { ANYTONE_DMR_ACK, anytoneDmrChecksum8AfterOpcode } from '../../kit/codecs/anytoneDmrRw.ts';
import { AT_D890_CONNECTION, D890_MAP } from './constants.ts';
import {
  atD890ProbeIdent,
  atD890ReadBlockRaw,
  atD890ReadMemory,
  atD890WriteBlockRaw,
  atD890WriteMemory,
} from './connection.ts';
import { assertAtD890TransmitAddress } from './writableExtents.ts';
import { AtD890ScriptedPipe, makeAtD890IdentFrame } from './__fixtures__/scriptedPipe.ts';

function makeReadReply(address: number, payload: Uint8Array): Uint8Array {
  const bodyLen = 6 + payload.length;
  const body = new Uint8Array(bodyLen);
  body[0] = 0x57;
  body[1] = (address >>> 24) & 0xff;
  body[2] = (address >>> 16) & 0xff;
  body[3] = (address >>> 8) & 0xff;
  body[4] = address & 0xff;
  body[5] = payload.length & 0xff;
  body.set(payload, 6);
  const checksum = anytoneDmrChecksum8AfterOpcode(body);
  const frame = new Uint8Array(bodyLen + 2);
  frame.set(body, 0);
  frame[bodyLen] = checksum;
  frame[bodyLen + 1] = ANYTONE_DMR_ACK;
  return frame;
}

const ADDRESS = 0x4f8_0000;

describe('parseAtD890Ident', () => {
  it('parses ID890UV / V100 when byte 8 and byte 13 are 0x06', async () => {
    const pipe = new AtD890ScriptedPipe();
    const raw = makeAtD890IdentFrame('V100', { band: 0x06, byte13: 0x06 });
    pipe.enqueue(raw);
    const ident = await atD890ProbeIdent(pipe);
    expect(ident.model).toBe('ID890UV');
    expect(ident.version).toBe('V100');
    expect(ident.bandCode).toBe(0x06);
    expect(ident.raw).toEqual(raw);
  });

  it('rejects a version other than V100', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.enqueue(makeAtD890IdentFrame('V101'));
    await expect(atD890ProbeIdent(pipe)).rejects.toBeInstanceOf(RadioWrongIdentError);
  });

  it('rejects a model other than ID890UV', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.enqueue(makeAtD890IdentFrame('V100', { model: 'D878UV2' }));
    await expect(atD890ProbeIdent(pipe)).rejects.toBeInstanceOf(RadioWrongIdentError);
  });
});

describe('atD890WriteMemory allow-list', () => {
  it('refuses LocalInfo before serial I/O', async () => {
    const pipe = new AtD890ScriptedPipe();
    await expect(atD890WriteMemory(pipe, D890_MAP.LocalInfo, new Uint8Array(0x10))).rejects.toThrow(
      RadioProtocolError,
    );
    expect(pipe.writes).toHaveLength(0);
  });

  it('emits only 16-byte write payloads', async () => {
    const pipe = new AtD890ScriptedPipe();
    const data = new Uint8Array(0x20);
    pipe.enqueue(new Uint8Array([ANYTONE_DMR_ACK]));
    pipe.enqueue(new Uint8Array([ANYTONE_DMR_ACK]));
    await atD890WriteMemory(pipe, D890_MAP.ChannelSet, data);
    const writeFrames = pipe.writes.filter((w) => w[0] === 0x57);
    expect(writeFrames).toHaveLength(2);
    for (const frame of writeFrames) {
      expect(frame[5]).toBe(0x10);
    }
  });

  it('paces a single-block write when the delay is enabled', async () => {
    // Regression: the delay used to be gated on `remaining > 0`, so it never fired for the
    // 16-byte chunks the upload loop passes, and B1 experiment E2 was silently a no-op for
    // three hardware runs. Ships disabled (0) — this locks the wiring, not the value.
    const original = AT_D890_CONNECTION.INTER_BLOCK_DELAY_MS;
    (AT_D890_CONNECTION as { INTER_BLOCK_DELAY_MS: number }).INTER_BLOCK_DELAY_MS = 40;
    try {
      const pipe = new AtD890ScriptedPipe();
      pipe.enqueue(new Uint8Array([ANYTONE_DMR_ACK]));
      const started = Date.now();
      await atD890WriteMemory(pipe, D890_MAP.ChannelSet, new Uint8Array(0x10));
      // Timer granularity can fire a few ms early; assert the delay clearly happened.
      expect(Date.now() - started).toBeGreaterThanOrEqual(30);
    } finally {
      (AT_D890_CONNECTION as { INTER_BLOCK_DELAY_MS: number }).INTER_BLOCK_DELAY_MS = original;
    }
  });

  it('permits optional settings when transmit guard includes touched unit', async () => {
    const pipe = new AtD890ScriptedPipe();
    const touched = new Set([0x350_0000]);
    const guard = (addr: number) => assertAtD890TransmitAddress(addr, touched);
    pipe.enqueue(new Uint8Array([ANYTONE_DMR_ACK]));
    await atD890WriteMemory(pipe, D890_MAP.OptionalSettingsMain, new Uint8Array(0x10), undefined, {
      transmitGuard: guard,
    });
    expect(pipe.writes.filter((w) => w[0] === 0x57)).toHaveLength(1);
  });
});

describe('hard deny before any caller guard', () => {
  const permissive = { transmitGuard: () => {} };
  const denied = [0x04f8_0000, 0x04f0_0000, 0x04f7_fff0, 0x04ff_fff0, 0x03a3_fbf0, 0x02fa_0010];
  for (const addr of denied) {
    it(`atD890WriteMemory refuses 0x${addr.toString(16)} with a permissive guard`, async () => {
      const pipe = new AtD890ScriptedPipe();
      await expect(
        atD890WriteMemory(pipe, addr, new Uint8Array(0x10), undefined, permissive),
      ).rejects.toThrow(RadioProtocolError);
      expect(pipe.writes.filter((w) => w[0] === 0x57)).toHaveLength(0);
      expect(pipe.writes).toHaveLength(0);
    });
    it(`atD890WriteBlockRaw refuses 0x${addr.toString(16)}`, async () => {
      const pipe = new AtD890ScriptedPipe();
      await expect(atD890WriteBlockRaw(pipe, addr, new Uint8Array(0x10))).rejects.toThrow(
        RadioProtocolError,
      );
      expect(pipe.writes).toHaveLength(0);
    });
  }

  it('refuses a span that starts below the range and runs into it, before the first frame', async () => {
    const pipe = new AtD890ScriptedPipe();
    await expect(
      atD890WriteMemory(pipe, 0x04ef_ffe0, new Uint8Array(0x30), undefined, permissive),
    ).rejects.toThrow(/LocalInfo \/ calibration/);
    expect(pipe.writes).toHaveLength(0);
    await expect(atD890WriteBlockRaw(pipe, 0x04ef_ffe0, new Uint8Array(0x30))).rejects.toThrow(
      RadioProtocolError,
    );
    expect(pipe.writes).toHaveLength(0);
  });
});

describe('atD890ReadMemory negotiated block size', () => {
  it('reads aligned spans in 240-byte chunks', async () => {
    const pipe = new AtD890ScriptedPipe();
    const payload = new Uint8Array(0xf0).map((_, i) => i & 0xff);
    pipe.enqueue(makeReadReply(ADDRESS, payload));
    const got = await atD890ReadMemory(pipe, ADDRESS, 0xf0, undefined, 0xf0);
    expect(got).toEqual(payload);
    const readFrames = pipe.writes.filter((w) => w[0] === 0x52);
    expect(readFrames).toHaveLength(1);
    expect(readFrames[0]![5]).toBe(0xf0);
  });

  it('handles trailing remainder when length is not a multiple of negotiated size', async () => {
    const pipe = new AtD890ScriptedPipe();
    const large = new Uint8Array(0xf0).map((_, i) => i & 0xff);
    const small = new Uint8Array(0x10).map((_, i) => (i + 0xf0) & 0xff);
    pipe.enqueue(makeReadReply(ADDRESS, large));
    pipe.enqueue(makeReadReply(ADDRESS + 0xf0, small));
    const got = await atD890ReadMemory(pipe, ADDRESS, 0x100, undefined, 0xf0);
    expect(got.subarray(0, 0xf0)).toEqual(large);
    expect(got.subarray(0xf0)).toEqual(small);
    const readFrames = pipe.writes.filter((w) => w[0] === 0x52);
    expect(readFrames).toHaveLength(2);
    expect(readFrames[0]![5]).toBe(0xf0);
    expect(readFrames[1]![5]).toBe(0x10);
  });

  it('falls back to 16-byte reads when a large chunk fails', async () => {
    const pipe = new AtD890ScriptedPipe();
    const full = new Uint8Array(0xf0).map((_, i) => i & 0xff);
    let rejectLarge = true;
    pipe.readResponder = (addr, len) => {
      const off = addr - ADDRESS;
      if (off < 0 || off + len > full.length) return null;
      if (len === 0xf0 && rejectLarge) {
        rejectLarge = false;
        return null;
      }
      return full.subarray(off, off + len);
    };
    const got = await atD890ReadMemory(pipe, ADDRESS, 0xf0, undefined, 0xf0);
    expect(got).toEqual(full);
    const readFrames = pipe.writes.filter((w) => w[0] === 0x52);
    expect(readFrames.filter((f) => f[5] === 0xf0)).toHaveLength(1);
    expect(readFrames.filter((f) => f[5] === 0x10)).toHaveLength(15);
  });
});

function readFrames(pipe: AtD890ScriptedPipe): Uint8Array[] {
  return pipe.writes.filter((frame) => frame[0] === 0x52);
}

function writeFrames(pipe: AtD890ScriptedPipe): Uint8Array[] {
  return pipe.writes.filter((frame) => frame[0] === 0x57);
}

describe('atD890 frame resend', () => {
  it('fails a mismatched echoed address without resending', async () => {
    const pipe = new AtD890ScriptedPipe();
    const payload = new Uint8Array(0x10).fill(0x11);
    pipe.enqueue(makeReadReply(ADDRESS + 0x10, payload));
    await expect(atD890ReadBlockRaw(pipe, ADDRESS, 0x10)).rejects.toThrow(/address mismatch/);
    expect(readFrames(pipe)).toHaveLength(1);
    expect(pipe.flushCount).toBe(0);
  });

  it('resends once after a bad checksum and does not flush', async () => {
    const pipe = new AtD890ScriptedPipe();
    const payload = new Uint8Array(0x10).fill(0x22);
    const good = makeReadReply(ADDRESS, payload);
    const bad = good.slice();
    bad[bad.length - 2]! ^= 0xff;
    pipe.enqueue(bad);
    pipe.enqueue(good);
    await expect(atD890ReadBlockRaw(pipe, ADDRESS, 0x10)).resolves.toEqual(payload);
    expect(readFrames(pipe)).toHaveLength(2);
    expect(pipe.flushCount).toBe(0);
  });

  it('flushes before each resend when a read times out twice', async () => {
    const pipe = new AtD890ScriptedPipe();
    const payload = new Uint8Array(0x10).fill(0x33);
    pipe.pendingTimeouts = 2;
    pipe.replyAfterTimeouts = makeReadReply(ADDRESS, payload);
    await expect(atD890ReadBlockRaw(pipe, ADDRESS, 0x10)).resolves.toEqual(payload);
    expect(readFrames(pipe)).toHaveLength(3);
    expect(pipe.flushCount).toBe(2);
  });

  it('stops after two read resends when every attempt times out', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.pendingTimeouts = 5;
    await expect(atD890ReadBlockRaw(pipe, ADDRESS, 0x10)).rejects.toBeInstanceOf(RadioTimeoutError);
    expect(readFrames(pipe)).toHaveLength(3);
    expect(pipe.flushCount).toBe(2);
  });

  it('does not resend a read with a bad trailer', async () => {
    const pipe = new AtD890ScriptedPipe();
    const frame = makeReadReply(ADDRESS, new Uint8Array(0x10).fill(1));
    frame[frame.length - 1] = 0x15;
    pipe.enqueue(frame);
    await expect(atD890ReadBlockRaw(pipe, ADDRESS, 0x10)).rejects.toThrow(/trailer/);
    expect(readFrames(pipe)).toHaveLength(1);
    expect(pipe.flushCount).toBe(0);
  });

  it('resends a timed-out write twice and then accepts 0x06', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.pendingTimeouts = 2;
    pipe.replyAfterTimeouts = new Uint8Array([ANYTONE_DMR_ACK]);
    await atD890WriteMemory(pipe, D890_MAP.ChannelSet, new Uint8Array(0x10));
    expect(writeFrames(pipe)).toHaveLength(3);
    expect(pipe.flushCount).toBe(2);
  });

  it('stops after two write resends when every attempt times out', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.pendingTimeouts = 5;
    await expect(
      atD890WriteBlockRaw(pipe, D890_MAP.ChannelSet, new Uint8Array(0x10)),
    ).rejects.toBeInstanceOf(RadioTimeoutError);
    expect(writeFrames(pipe)).toHaveLength(3);
    expect(pipe.flushCount).toBe(2);
  });

  it('does not resend a write when the ack is not 0x06', async () => {
    const pipe = new AtD890ScriptedPipe();
    pipe.enqueue(new Uint8Array([0x15]));
    await expect(
      atD890WriteMemory(pipe, D890_MAP.ChannelSet, new Uint8Array(0x10)),
    ).rejects.toThrow(/not ACKed/);
    expect(writeFrames(pipe)).toHaveLength(1);
    expect(pipe.flushCount).toBe(0);
  });
});

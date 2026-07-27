import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import { ANYTONE_DMR_ACK, anytoneDmrChecksum8AfterOpcode } from '../../kit/codecs/anytoneDmrRw.ts';
import { D890_MAP } from './constants.ts';
import { atD890ReadMemory, atD890WriteMemory } from './connection.ts';
import { assertAtD890TransmitAddress } from './writableExtents.ts';
import { AtD890ScriptedPipe } from './__fixtures__/scriptedPipe.ts';

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
    expect(readFrames.filter((f) => f[5] === 0x10).length).toBe(15);
  });
});

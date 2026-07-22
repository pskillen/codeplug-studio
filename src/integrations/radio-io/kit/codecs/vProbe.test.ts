import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { RadioProtocolError } from '../errors.ts';
import {
  exchangeVProbe,
  makeVInfoProbeFrame,
  makeVProbeFrame,
  parseVAddrRange,
  parseVAscii,
  parseVProbeReply,
  parseVU32LE,
  V_PROBE_OPCODE,
} from './vProbe.ts';

function mockPipe(scriptedReads: Uint8Array[]): {
  pipe: BytePipe;
  writes: Uint8Array[];
} {
  const writes: Uint8Array[] = [];
  const queue = [...scriptedReads];
  const pipe: BytePipe = {
    async write(data) {
      writes.push(data.slice());
    },
    async readExact(n) {
      const next = queue.shift();
      if (!next) {
        throw new Error('mockPipe: no scripted read left');
      }
      if (next.length !== n) {
        throw new Error(`mockPipe: expected read ${n}, scripted ${next.length}`);
      }
      return next.slice();
    },
    async close() {},
  };
  return { pipe, writes };
}

describe('vProbe frames', () => {
  it('builds V + u32 BE param', () => {
    expect(makeVProbeFrame(0x0a)).toEqual(new Uint8Array([0x56, 0x00, 0x00, 0x00, 0x0a]));
    expect(makeVInfoProbeFrame(0x0a)).toEqual(new Uint8Array([0x56, 0x00, 0x00, 0x00, 0x0a]));
    // Opaque UV-17-style handshake param
    expect(makeVProbeFrame(0x00000a0d)).toEqual(new Uint8Array([0x56, 0x00, 0x00, 0x0a, 0x0d]));
  });

  it('parses memsize reply and addr range (2× u32 LE)', () => {
    // 56 0A 08 + start=0x00001000 LE + end=0x0000FFFF LE
    const frame = new Uint8Array([
      0x56, 0x0a, 0x08, 0x00, 0x10, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00,
    ]);
    const reply = parseVProbeReply(frame);
    expect(reply.id).toBe(0x0a);
    expect(parseVAddrRange(reply.payload)).toEqual({ start: 0x00001000, end: 0x0000ffff });
    expect(parseVU32LE(reply.payload, 4)).toBe(0x0000ffff);
  });

  it('parses ASCII payloads with trailing NULs trimmed', () => {
    const ascii = new TextEncoder().encode('DM32.01\0\0');
    expect(parseVAscii(ascii)).toBe('DM32.01');
  });

  it('rejects bad opcode or length mismatch', () => {
    expect(() => parseVProbeReply(new Uint8Array([0x52, 0, 0]))).toThrow(RadioProtocolError);
    expect(() => parseVProbeReply(new Uint8Array([0x56, 0x0a, 0x02, 0x01]))).toThrow(
      RadioProtocolError,
    );
  });
});

describe('exchangeVProbe', () => {
  it('writes probe and reassembles header + payload reads', async () => {
    const payload = new Uint8Array([0x00, 0x10, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00]);
    const { pipe, writes } = mockPipe([
      new Uint8Array([V_PROBE_OPCODE, 0x0a, 0x08]),
      payload,
    ]);
    const reply = await exchangeVProbe(pipe, 0x0a, 100);
    expect(writes).toEqual([new Uint8Array([0x56, 0x00, 0x00, 0x00, 0x0a])]);
    expect(reply.id).toBe(0x0a);
    expect(parseVAddrRange(reply.payload)).toEqual({ start: 0x1000, end: 0xffff });
  });
});

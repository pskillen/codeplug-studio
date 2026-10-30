import { describe, expect, it } from 'vitest';
import { crc16CcittFalse } from '../../kit/checksums.ts';
import { decodeDebugFrame, encodeDebugFrame } from './frame.ts';

describe('RadioFoundry debug-link frames', () => {
  it('matches the spec INFO request, including CRC-16/CCITT-FALSE', () => {
    const frame = encodeDebugFrame(0x1c, 0x31, Uint8Array.of(0x00));
    expect([...frame]).toEqual([0xa5, 0x5a, 0x1c, 0x31, 0x01, 0x00, 0x00, 0x10, 0xf3]);
    expect(crc16CcittFalse(frame.subarray(2, 7))).toBe(0xf310);
    expect(decodeDebugFrame(frame)).toMatchObject({ command: 0x1c, seq: 0x31 });
  });

  it('rejects a frame whose CRC was flipped', () => {
    const frame = encodeDebugFrame(0x1c, 0x01, Uint8Array.of(0x07));
    frame[frame.length - 1] ^= 0xff;
    expect(() => decodeDebugFrame(frame)).toThrow(/CRC/);
  });
});

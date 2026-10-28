import { describe, expect, it } from 'vitest';
import { crc16CcittFalse, crc32Ieee, crc8Poly07 } from './checksums.ts';

const CHECK = new TextEncoder().encode('123456789');

describe('checksums', () => {
  it('crc16CcittFalse check value', () => {
    expect(crc16CcittFalse(CHECK)).toBe(0x29b1);
  });

  it('crc32Ieee check value', () => {
    expect(crc32Ieee(CHECK)).toBe(0xcbf43926);
  });

  it('crc8Poly07 check value', () => {
    expect(crc8Poly07(CHECK)).toBe(0xf4);
  });

  it('crc8Poly07 of nothing is 0', () => {
    expect(crc8Poly07(new Uint8Array(0))).toBe(0);
  });

  it('crc8Poly07 fingerprints of the synthetic MMD1 channels', () => {
    const enc = new TextEncoder();
    const ch1 = new Uint8Array([0x14, 0x65, 0x20, 0x00, ...enc.encode('TEST01')]);
    const ch3 = new Uint8Array([0x43, 0x35, 0x00, 0x00, ...enc.encode('TEST03')]);
    expect(crc8Poly07(ch1)).toBe(0x98);
    expect(crc8Poly07(ch3)).toBe(0xac);
  });
});

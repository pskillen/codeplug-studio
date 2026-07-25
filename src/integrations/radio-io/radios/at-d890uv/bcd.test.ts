import { describe, expect, it } from 'vitest';
import { decodeBcdFrequencyHz, encodeBcdFrequencyHz } from './bcd.ts';

describe('AT-D890UV BCD frequency packing', () => {
  it('decodes hardware BCD bytes 43 94 25 00 as 439.425 MHz', () => {
    const wire = new Uint8Array([0x43, 0x94, 0x25, 0x00]);
    expect(decodeBcdFrequencyHz(wire)).toBe(439_425_000);
  });

  it('encodes 439.425 MHz as BCD-as-hex, not Hz-as-hex', () => {
    const encoded = encodeBcdFrequencyHz(439_425_000);
    expect([...encoded]).toEqual([0x43, 0x94, 0x25, 0x00]);
    // Regression: binary hex of Hz would be 1a 31 17 e8
    expect([...encoded]).not.toEqual([0x1a, 0x31, 0x17, 0xe8]);
  });

  it('round-trips common VHF/UHF frequencies', () => {
    for (const hz of [145_520_000, 430_000_000, 439_425_000, 146_520_000]) {
      expect(decodeBcdFrequencyHz(encodeBcdFrequencyHz(hz))).toBe(hz);
    }
  });

  it('returns 0 for short buffers and non-digit wire', () => {
    expect(decodeBcdFrequencyHz(new Uint8Array([0x43, 0x94]))).toBe(0);
    expect(decodeBcdFrequencyHz(new Uint8Array([0x1a, 0x31, 0x17, 0xe8]))).toBe(0);
  });

  it('encodes zero as four zero bytes', () => {
    expect([...encodeBcdFrequencyHz(0)]).toEqual([0, 0, 0, 0]);
  });
});

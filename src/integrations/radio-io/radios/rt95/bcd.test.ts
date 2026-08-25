import { describe, expect, it } from 'vitest';
import { decodeBcdFreq, encodeBcdFreq } from './bcd.ts';

describe('rt95 bbcd frequency packing', () => {
  it('encodes 146.52 MHz as CHIRP bbcd MSD-first', () => {
    expect([...encodeBcdFreq(146_520_000)]).toEqual([0x14, 0x65, 0x20, 0x00]);
  });

  it('encodes 430.850 MHz as CHIRP bbcd', () => {
    expect([...encodeBcdFreq(430_850_000)]).toEqual([0x43, 0x08, 0x50, 0x00]);
  });

  it('encodes 7.6 MHz offset as CHIRP bbcd', () => {
    expect([...encodeBcdFreq(7_600_000)]).toEqual([0x00, 0x76, 0x00, 0x00]);
  });

  it('does not use LSD-first packing', () => {
    expect([...encodeBcdFreq(146_520_000)]).not.toEqual([0x00, 0x20, 0x65, 0x14]);
    expect([...encodeBcdFreq(7_600_000)]).not.toEqual([0x00, 0x00, 0x76, 0x00]);
  });

  it('round-trips common VHF/UHF frequencies', () => {
    for (const hz of [0, 146_520_000, 430_850_000, 7_600_000, 600_000]) {
      expect(decodeBcdFreq(encodeBcdFreq(hz))).toBe(hz);
    }
  });
});

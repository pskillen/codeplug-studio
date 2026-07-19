import { describe, expect, it } from 'vitest';
import {
  formatOffsetMhz,
  frequencyOffsetMhz,
  offsetsMatch,
  txFrequencyHzFromOffset,
  txOffsetsForFrequencyHz,
} from './txOffsets.ts';

describe('frequencyOffsetMhz', () => {
  it('returns TX − RX in MHz', () => {
    expect(frequencyOffsetMhz(145_500_000, 145_100_000)).toBeCloseTo(-0.4, 5);
    expect(frequencyOffsetMhz(433_000_000, 440_600_000)).toBeCloseTo(7.6, 5);
  });

  it('returns null when either side is missing', () => {
    expect(frequencyOffsetMhz(null, 145_000_000)).toBeNull();
    expect(frequencyOffsetMhz(145_000_000, null)).toBeNull();
  });
});

describe('formatOffsetMhz', () => {
  it('formats simplex as ===', () => {
    expect(formatOffsetMhz(0)).toBe('===');
    expect(formatOffsetMhz(0.0001)).toBe('===');
  });

  it('formats signed MHz', () => {
    expect(formatOffsetMhz(-0.6)).toBe('-0.6 MHz');
    expect(formatOffsetMhz(7.6)).toBe('+7.6 MHz');
    expect(formatOffsetMhz(9)).toBe('+9 MHz');
  });

  it('returns null for null input', () => {
    expect(formatOffsetMhz(null)).toBeNull();
  });
});

describe('txOffsetsForFrequencyHz', () => {
  it('offers 2 m simplex and −0.6', () => {
    const options = txOffsetsForFrequencyHz(145_500_000);
    expect(options.map((o) => o.offsetMhz)).toEqual([0, -0.6]);
  });

  it('offers 70 cm simplex, +7.6, and +9.0', () => {
    const options = txOffsetsForFrequencyHz(433_000_000);
    expect(options.map((o) => o.offsetMhz)).toEqual([0, 7.6, 9.0]);
  });

  it('defaults to simplex only for undocumented bands', () => {
    expect(txOffsetsForFrequencyHz(51_000_000).map((o) => o.offsetMhz)).toEqual([0]);
  });

  it('defaults to simplex when RX is missing', () => {
    expect(txOffsetsForFrequencyHz(null).map((o) => o.offsetMhz)).toEqual([0]);
  });
});

describe('offsetsMatch / txFrequencyHzFromOffset', () => {
  it('matches within epsilon', () => {
    expect(offsetsMatch(-0.6, -0.6001)).toBe(true);
    expect(offsetsMatch(-0.6, -0.7)).toBe(false);
  });

  it('computes TX Hz from RX + offset', () => {
    expect(txFrequencyHzFromOffset(145_500_000, -0.6)).toBe(144_900_000);
  });
});

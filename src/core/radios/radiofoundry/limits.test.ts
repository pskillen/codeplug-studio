import { describe, expect, it } from 'vitest';
import { formatRadioFoundryBands, isInRadioFoundryBand, type RadioFoundryBand } from './limits.ts';

const BANDS: RadioFoundryBand[] = [
  { minHz: 136_000_000, maxHz: 174_000_000 },
  { minHz: 400_000_000, maxHz: 480_000_000 },
];

describe('isInRadioFoundryBand', () => {
  it('includes both edges of a band', () => {
    expect(isInRadioFoundryBand(136_000_000, BANDS)).toBe(true);
    expect(isInRadioFoundryBand(174_000_000, BANDS)).toBe(true);
    expect(isInRadioFoundryBand(480_000_000, BANDS)).toBe(true);
  });

  it('excludes frequencies between and beyond the bands', () => {
    expect(isInRadioFoundryBand(175_000_000, BANDS)).toBe(false);
    expect(isInRadioFoundryBand(480_000_001, BANDS)).toBe(false);
    expect(isInRadioFoundryBand(135_999_999, BANDS)).toBe(false);
  });
});

describe('formatRadioFoundryBands', () => {
  it('lists the bands in plain MHz', () => {
    expect(formatRadioFoundryBands(BANDS)).toBe('136-174 and 400-480 MHz');
  });
});

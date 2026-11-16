import { describe, expect, it } from 'vitest';
import { formatDecimal, formatHex, formatHexDec, formatNumber, NOT_CAPTURED_TEXT } from './format.ts';

describe('debugView format', () => {
  it('pads hex to the byte width', () => {
    expect(formatHex(0x1a)).toBe('0x1A');
    expect(formatHex(0x7d0, 2)).toBe('0x07D0');
    expect(formatHex(5, 4)).toBe('0x00000005');
  });

  it('prints hex and decimal together', () => {
    expect(formatHexDec(26)).toBe('0x1A (26)');
    expect(formatHexDec(2000, 2)).toBe('0x07D0 (2000)');
    expect(formatHexDec(0)).toBe('0x00 (0)');
  });

  it('prints decimal with an optional unit', () => {
    expect(formatDecimal(145)).toBe('145');
    expect(formatDecimal(145, 'MHz')).toBe('145 MHz');
  });

  it('dispatches on the format and dashes missing values', () => {
    expect(formatNumber(26, 'hex-dec')).toBe('0x1A (26)');
    expect(formatNumber(26, 'hex')).toBe('0x1A');
    expect(formatNumber(26, 'decimal', 1, 'V')).toBe('26 V');
    expect(formatNumber(undefined, 'hex-dec')).toBe(NOT_CAPTURED_TEXT);
  });
});

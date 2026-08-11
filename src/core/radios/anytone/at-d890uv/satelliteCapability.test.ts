import { describe, expect, it } from 'vitest';
import { isModeSupportedByAtD890 } from './satelliteCapability.ts';

describe('isModeSupportedByAtD890', () => {
  it('returns false for a denylisted mode', () => {
    expect(isModeSupportedByAtD890('SSTV')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isModeSupportedByAtD890('sstv')).toBe(false);
    expect(isModeSupportedByAtD890('Sstv')).toBe(false);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isModeSupportedByAtD890('  SSTV  ')).toBe(false);
  });

  it('returns true for a known-supported mode', () => {
    expect(isModeSupportedByAtD890('FM')).toBe(true);
  });

  it('returns true for an unrecognised mode string (defaults to supported)', () => {
    expect(isModeSupportedByAtD890('BPSK')).toBe(true);
  });

  it('returns true for null or undefined mode', () => {
    expect(isModeSupportedByAtD890(null)).toBe(true);
    expect(isModeSupportedByAtD890(undefined)).toBe(true);
  });

  it('returns true for an empty string', () => {
    expect(isModeSupportedByAtD890('')).toBe(true);
  });
});

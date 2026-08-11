import { describe, expect, it } from 'vitest';
import { isModeSupportedByAtD890 } from './satelliteCapability.ts';

describe('isModeSupportedByAtD890', () => {
  it('returns true for FM, the operator-confirmed supported mode', () => {
    expect(isModeSupportedByAtD890('FM')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isModeSupportedByAtD890('fm')).toBe(true);
    expect(isModeSupportedByAtD890('Fm')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isModeSupportedByAtD890('  FM  ')).toBe(true);
  });

  it('accepts reasonable FM-narrow spelling variants', () => {
    expect(isModeSupportedByAtD890('FMN')).toBe(true);
    expect(isModeSupportedByAtD890('NFM')).toBe(true);
    expect(isModeSupportedByAtD890('FM Narrow')).toBe(true);
    expect(isModeSupportedByAtD890('fm-narrow')).toBe(true);
    expect(isModeSupportedByAtD890('Narrow FM')).toBe(true);
    expect(isModeSupportedByAtD890('narrow_fm')).toBe(true);
  });

  it('returns false for modes the operator reported failing on real hardware (regression for #1086)', () => {
    expect(isModeSupportedByAtD890('GMSK')).toBe(false);
    expect(isModeSupportedByAtD890('AFSK')).toBe(false);
    expect(isModeSupportedByAtD890('DUV')).toBe(false);
  });

  it('returns false for modes previously on the denylist (still unsupported)', () => {
    expect(isModeSupportedByAtD890('SSTV')).toBe(false);
    expect(isModeSupportedByAtD890('SSB')).toBe(false);
    expect(isModeSupportedByAtD890('CW')).toBe(false);
  });

  it('returns false for an unrecognised mode string (now defaults to NOT supported)', () => {
    expect(isModeSupportedByAtD890('BPSK')).toBe(false);
  });

  it('returns true for null or undefined mode (no mode info to reject on)', () => {
    expect(isModeSupportedByAtD890(null)).toBe(true);
    expect(isModeSupportedByAtD890(undefined)).toBe(true);
  });

  it('returns true for an empty string', () => {
    expect(isModeSupportedByAtD890('')).toBe(true);
  });
});

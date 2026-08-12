import { describe, expect, it } from 'vitest';
import { isFrequencyInD890SatelliteRange, isModeSupportedByAtD890 } from './satelliteCapability.ts';

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

describe('isFrequencyInD890SatelliteRange', () => {
  it('returns true for a 2m ham-band frequency (145.85 MHz)', () => {
    expect(isFrequencyInD890SatelliteRange(145_850_000)).toBe(true);
  });

  it('returns true for a 70cm ham-band frequency (436.795 MHz)', () => {
    expect(isFrequencyInD890SatelliteRange(436_795_000)).toBe(true);
  });

  it('returns false for a realistic L-band satellite uplink (1269 MHz)', () => {
    expect(isFrequencyInD890SatelliteRange(1_269_000_000)).toBe(false);
  });

  it('returns false for the AM airband and FM broadcast ranges even though the D890 covers them for channels', () => {
    expect(isFrequencyInD890SatelliteRange(120_000_000)).toBe(false); // AM airband
    expect(isFrequencyInD890SatelliteRange(100_000_000)).toBe(false); // FM broadcast, receive-only
  });

  it('returns false for a frequency between the two ham bands', () => {
    expect(isFrequencyInD890SatelliteRange(300_000_000)).toBe(false);
  });

  it('returns true at the exact band edges', () => {
    expect(isFrequencyInD890SatelliteRange(136_000_000)).toBe(true);
    expect(isFrequencyInD890SatelliteRange(174_000_000)).toBe(true);
    expect(isFrequencyInD890SatelliteRange(400_000_000)).toBe(true);
    expect(isFrequencyInD890SatelliteRange(480_000_000)).toBe(true);
  });

  it('returns true for null or undefined (no positive evidence against an unset frequency)', () => {
    expect(isFrequencyInD890SatelliteRange(null)).toBe(true);
    expect(isFrequencyInD890SatelliteRange(undefined)).toBe(true);
  });
});

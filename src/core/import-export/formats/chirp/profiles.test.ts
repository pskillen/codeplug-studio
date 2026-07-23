import { describe, expect, it } from 'vitest';
import {
  CHIRP_PROFILES,
  chirpPercentToWire,
  chirpWireToPercent,
  getChirpProfile,
  resolveChirpExportProfileId,
} from './profiles.ts';

describe('chirp/profiles', () => {
  it('registers three Studio profile ids', () => {
    expect(CHIRP_PROFILES.map((p) => p.id)).toEqual(['chirp-uv5r', 'chirp-uv21', 'chirp-rt95']);
  });

  it('UV-5R Mini uses 999 memory slots and 12-char names', () => {
    const profile = getChirpProfile('chirp-uv5r');
    expect(profile.maxMemorySlots).toBe(999);
    expect(profile.nameLimit).toBe(12);
  });

  it('UV-5R power ladder round-trips', () => {
    expect(chirpWireToPercent('chirp-uv5r', '5.0W')).toBe(100);
    expect(chirpWireToPercent('chirp-uv5r', '1.0W')).toBe(20);
    expect(chirpPercentToWire('chirp-uv5r', 100)).toBe('5.0W');
    expect(chirpPercentToWire('chirp-uv5r', null)).toBe('5.0W');
  });

  it('UV-21Pro V2 uses 1000 memory slots and 12-char names (UV17Pro family)', () => {
    const profile = getChirpProfile('chirp-uv21');
    expect(profile.maxMemorySlots).toBe(1000);
    expect(profile.nameLimit).toBe(12);
    expect(chirpWireToPercent('chirp-uv21', '5.0W')).toBe(100);
    expect(chirpWireToPercent('chirp-uv21', '1.0W')).toBe(20);
  });

  it('RT95 VOX uses 200 memory slots and 6-char names', () => {
    const profile = getChirpProfile('chirp-rt95');
    expect(profile.maxMemorySlots).toBe(200);
    expect(profile.nameLimit).toBe(6);
  });

  it('RT95 power ladder round-trips', () => {
    expect(chirpWireToPercent('chirp-rt95', '25W')).toBe(100);
    expect(chirpWireToPercent('chirp-rt95', '10W')).toBe(40);
    expect(chirpWireToPercent('chirp-rt95', '5.0W')).toBe(20);
    expect(chirpPercentToWire('chirp-rt95', null)).toBe('25W');
  });

  it('throws for unknown profile', () => {
    expect(() => getChirpProfile('baofeng-uv5r-mini')).toThrow(/Unknown CHIRP profile/);
  });

  it('resolveChirpExportProfileId ignores poisoned non-CHIRP ids from egress switches', () => {
    expect(resolveChirpExportProfileId('neonplug-uv5rmini', 'chirp-uv5r')).toBe('chirp-uv5r');
    expect(resolveChirpExportProfileId('radio-io-uv5r-mini', 'chirp-uv5r')).toBe('chirp-uv5r');
    expect(resolveChirpExportProfileId('chirp-uv21', 'chirp-uv5r')).toBe('chirp-uv21');
  });
});

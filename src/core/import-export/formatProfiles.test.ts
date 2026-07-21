import { describe, expect, it } from 'vitest';
import { formatProfileWireHint, getFormatProfiles } from '@core/import-export/formatProfiles.ts';

describe('formatProfiles', () => {
  it('lists OpenGD77 profiles for UI', () => {
    const profiles = getFormatProfiles('opengd77');
    expect(profiles.map((p) => p.profileId).sort()).toEqual(['opengd77-1701', 'opengd77-md9600']);
    expect(profiles[0]?.nameLimit).toBe(16);
  });

  it('lists CHIRP profiles for UI', () => {
    const profiles = getFormatProfiles('chirp');
    expect(profiles.map((p) => p.profileId).sort()).toEqual([
      'chirp-rt95',
      'chirp-uv21',
      'chirp-uv5r',
    ]);
    expect(profiles.find((p) => p.profileId === 'chirp-uv5r')?.nameLimit).toBe(12);
    expect(profiles.find((p) => p.profileId === 'chirp-uv5r')?.maxChannels).toBe(999);
  });

  it('lists NeonPlug profiles for UI', () => {
    const profiles = getFormatProfiles('neonplug');
    expect(profiles.map((p) => p.profileId).sort()).toEqual([
      'neonplug-dm32uv',
      'neonplug-uv5rmini',
    ]);
    expect(profiles.find((p) => p.profileId === 'neonplug-dm32uv')?.nameLimit).toBe(16);
    expect(profiles.find((p) => p.profileId === 'neonplug-dm32uv')?.maxChannels).toBe(4000);
    expect(profiles.find((p) => p.profileId === 'neonplug-uv5rmini')?.nameLimit).toBe(12);
    expect(profiles.find((p) => p.profileId === 'neonplug-uv5rmini')?.maxChannels).toBe(999);
  });

  it('returns wire hint for OpenGD77 and CHIRP profiles', () => {
    expect(formatProfileWireHint('opengd77', 'opengd77-1701')).toMatch(/16-char/);
    expect(formatProfileWireHint('chirp', 'chirp-uv5r')).toMatch(/12-char/);
    expect(formatProfileWireHint('chirp', 'chirp-uv5r')).toMatch(/999/);
  });

  it('returns wire hint for NeonPlug profiles', () => {
    expect(formatProfileWireHint('neonplug', 'neonplug-dm32uv')).toMatch(/16-char/);
    expect(formatProfileWireHint('neonplug', 'neonplug-dm32uv')).toMatch(/4000/);
    expect(formatProfileWireHint('neonplug', 'neonplug-uv5rmini')).toMatch(/12-char/);
    expect(formatProfileWireHint('neonplug', 'neonplug-uv5rmini')).toMatch(/999/);
  });
});

import { describe, expect, it } from 'vitest';
import { formatProfileWireHint, getFormatProfiles } from '@core/import-export/formatProfiles.ts';

describe('formatProfiles', () => {
  it('lists OpenGD77 profiles for UI', () => {
    const profiles = getFormatProfiles('opengd77');
    expect(profiles.map((p) => p.profileId).sort()).toEqual(['opengd77-1701', 'opengd77-md9600']);
    expect(profiles[0]?.nameLimit).toBe(16);
  });

  it('returns wire hint for OpenGD77 profiles only', () => {
    expect(formatProfileWireHint('opengd77', 'opengd77-1701')).toMatch(/16-char/);
    expect(formatProfileWireHint('chirp', 'chirp-uv5r')).toBeNull();
  });
});

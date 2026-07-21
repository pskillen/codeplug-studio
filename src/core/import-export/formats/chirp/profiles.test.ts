import { describe, expect, it } from 'vitest';
import {
  CHIRP_PROFILES,
  chirpPercentToWire,
  chirpWireToPercent,
  getChirpProfile,
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

  it('RT95 power ladder round-trips', () => {
    expect(chirpWireToPercent('chirp-rt95', '25W')).toBe(100);
    expect(chirpWireToPercent('chirp-rt95', '10W')).toBe(40);
    expect(chirpPercentToWire('chirp-rt95', null)).toBe('25W');
  });

  it('throws for unknown profile', () => {
    expect(() => getChirpProfile('baofeng-uv5r-mini')).toThrow(/Unknown CHIRP profile/);
  });
});

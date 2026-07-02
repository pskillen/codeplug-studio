import { describe, expect, it } from 'vitest';
import { percentToWire, wireToPercent } from '../../profileLadder.ts';
import {
  getOpenGd77Profile,
  opengd77PercentToWire,
  opengd77WireToPercent,
} from './profiles.ts';

describe('profileLadder', () => {
  it('maps exact wire to percent', () => {
    const profile = getOpenGd77Profile('opengd77-1701');
    expect(wireToPercent(profile, 'P9')).toBe(100);
    expect(wireToPercent(profile, 'P2')).toBe(5);
    expect(wireToPercent(profile, '')).toBeNull();
    expect(wireToPercent(profile, 'unknown')).toBeNull();
  });

  it('maps percent to nearest ladder wire', () => {
    const profile = getOpenGd77Profile('opengd77-1701');
    expect(percentToWire(profile, 100)).toBe('P9');
    expect(percentToWire(profile, 82)).toBe('P8');
    expect(percentToWire(profile, null)).toBe('P9');
  });
});

describe('OpenGD77 power ladder', () => {
  it('round-trips 1701 P-levels', () => {
    expect(opengd77WireToPercent('opengd77-1701', 'P9')).toBe(100);
    expect(opengd77WireToPercent('opengd77-1701', 'P2')).toBe(5);
    expect(opengd77WireToPercent('opengd77-1701', 'Master')).toBeNull();
    expect(opengd77PercentToWire('opengd77-1701', 100)).toBe('P9');
    expect(opengd77PercentToWire('opengd77-1701', null)).toBe('Master');
  });

  it('round-trips MD9600 P-levels', () => {
    expect(opengd77WireToPercent('opengd77-md9600', 'P8')).toBe(100);
    expect(opengd77WireToPercent('opengd77-md9600', 'P2')).toBe(2);
    expect(opengd77PercentToWire('opengd77-md9600', 100)).toBe('P8');
    expect(opengd77PercentToWire('opengd77-md9600', 3)).toBe('P3');
  });

  it('throws for unknown profile', () => {
    expect(() => getOpenGd77Profile('unknown')).toThrow(/Unknown OpenGD77 profile/);
  });
});

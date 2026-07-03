import { describe, expect, it } from 'vitest';
import { percentToWire, wireToPercent } from '../../profileLadder.ts';
import {
  dm32PercentToSquelchWire,
  dm32PercentToWire,
  dm32SquelchWireToPercent,
  dm32WireToPercent,
  getDm32Profile,
} from './profiles.ts';

describe('profileLadder (DM32)', () => {
  it('maps exact power wire to percent', () => {
    const profile = getDm32Profile('dm32-baofeng-dm32uv');
    expect(wireToPercent(profile, 'High')).toBe(100);
    expect(wireToPercent(profile, 'Middle')).toBe(50);
    expect(wireToPercent(profile, 'Low')).toBe(20);
    expect(wireToPercent(profile, '')).toBeNull();
    expect(wireToPercent(profile, 'unknown')).toBeNull();
  });

  it('maps percent to nearest power wire', () => {
    const profile = getDm32Profile('dm32-baofeng-dm32uv');
    expect(percentToWire(profile, 100)).toBe('High');
    expect(percentToWire(profile, 55)).toBe('Middle');
    expect(percentToWire(profile, null)).toBe('High');
  });
});

describe('DM32 power ladder', () => {
  it('round-trips High/Middle/Low', () => {
    expect(dm32WireToPercent('dm32-baofeng-dm32uv', 'High')).toBe(100);
    expect(dm32WireToPercent('dm32-baofeng-dm32uv', 'Low')).toBe(20);
    expect(dm32PercentToWire('dm32-baofeng-dm32uv', 100)).toBe('High');
    expect(dm32PercentToWire('dm32-baofeng-dm32uv', null)).toBe('High');
  });

  it('throws for unknown profile', () => {
    expect(() => getDm32Profile('unknown')).toThrow(/Unknown DM32 profile/);
  });
});

describe('DM32 squelch ladder', () => {
  it('round-trips squelch levels 0–9', () => {
    expect(dm32SquelchWireToPercent('dm32-baofeng-dm32uv', '0')).toBe(0);
    expect(dm32SquelchWireToPercent('dm32-baofeng-dm32uv', '9')).toBe(100);
    expect(dm32PercentToSquelchWire('dm32-baofeng-dm32uv', 100)).toBe('9');
    expect(dm32PercentToSquelchWire('dm32-baofeng-dm32uv', null)).toBe('0');
  });
});

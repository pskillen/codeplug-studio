import { describe, expect, it } from 'vitest';
import {
  ANYTONE_PROFILES,
  anytonePercentToWire,
  anytoneWireToPercent,
  getAnytoneProfile,
} from './profiles.ts';

describe('anytone profiles', () => {
  it('lists at-d890uv profile', () => {
    expect(ANYTONE_PROFILES.map((p) => p.id)).toEqual(['anytone-at-d890uv']);
  });

  it('round-trips power ladder for all four wire values', () => {
    expect(anytoneWireToPercent('anytone-at-d890uv', 'Turbo')).toBe(100);
    expect(anytoneWireToPercent('anytone-at-d890uv', 'High')).toBe(75);
    expect(anytoneWireToPercent('anytone-at-d890uv', 'Mid')).toBe(50);
    expect(anytoneWireToPercent('anytone-at-d890uv', 'Low')).toBe(25);

    expect(anytonePercentToWire('anytone-at-d890uv', 100)).toBe('Turbo');
    expect(anytonePercentToWire('anytone-at-d890uv', 75)).toBe('High');
    expect(anytonePercentToWire('anytone-at-d890uv', 50)).toBe('Mid');
    expect(anytonePercentToWire('anytone-at-d890uv', 25)).toBe('Low');
  });

  it('maps nearest percent and null to Turbo', () => {
    expect(anytonePercentToWire('anytone-at-d890uv', null)).toBe('Turbo');
    expect(anytonePercentToWire('anytone-at-d890uv', 5)).toBe('Low');
    expect(anytonePercentToWire('anytone-at-d890uv', 40)).toBe('Mid');
    expect(anytonePercentToWire('anytone-at-d890uv', 63)).toBe('High');
    expect(anytonePercentToWire('anytone-at-d890uv', 90)).toBe('Turbo');
  });

  it('throws for unknown profile', () => {
    expect(() => getAnytoneProfile('unknown')).toThrow(/Unknown Anytone profile/);
  });
});

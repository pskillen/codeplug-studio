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

  it('round-trips power ladder', () => {
    expect(anytoneWireToPercent('anytone-at-d890uv', 'High')).toBe(100);
    expect(anytoneWireToPercent('anytone-at-d890uv', 'Low')).toBe(25);
    expect(anytonePercentToWire('anytone-at-d890uv', 100)).toBe('High');
    expect(anytonePercentToWire('anytone-at-d890uv', 25)).toBe('Low');
  });

  it('throws for unknown profile', () => {
    expect(() => getAnytoneProfile('unknown')).toThrow(/Unknown Anytone profile/);
  });
});

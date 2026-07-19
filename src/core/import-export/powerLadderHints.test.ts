import { describe, expect, it } from 'vitest';
import {
  listPowerLadderHints,
  listShippedPowerLadderProfiles,
  resolvePowerLadderProfileKeys,
} from './powerLadderHints.ts';

describe('listShippedPowerLadderProfiles', () => {
  it('includes OpenGD77, DM32, CHIRP, and Anytone profiles', () => {
    const keys = listShippedPowerLadderProfiles();
    expect(keys.some((k) => k.profileId === 'opengd77-1701')).toBe(true);
    expect(keys.some((k) => k.profileId === 'dm32-baofeng-dm32uv')).toBe(true);
    expect(keys.some((k) => k.profileId === 'chirp-uv5r')).toBe(true);
    expect(keys.some((k) => k.profileId === 'anytone-at-d890uv')).toBe(true);
    expect(keys.some((k) => k.formatId === 'native-yaml')).toBe(false);
  });
});

describe('resolvePowerLadderProfileKeys', () => {
  it('falls back to shipped profiles when builds are empty', () => {
    expect(resolvePowerLadderProfileKeys([])).toEqual(listShippedPowerLadderProfiles());
  });

  it('dedupes build profiles and preserves order', () => {
    expect(
      resolvePowerLadderProfileKeys([
        { formatId: 'anytone', profileId: 'anytone-at-d890uv' },
        { formatId: 'anytone', profileId: 'anytone-at-d890uv' },
        { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' },
      ]),
    ).toEqual([
      { formatId: 'anytone', profileId: 'anytone-at-d890uv' },
      { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' },
    ]);
  });
});

describe('listPowerLadderHints', () => {
  it('maps null power to OpenGD77 Master / radio default', () => {
    const rows = listPowerLadderHints(null, [
      { formatId: 'opengd77', profileId: 'opengd77-1701' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      wire: 'Master',
      approxWatts: 'radio default',
      isRadioDefault: true,
    });
  });

  it('maps exact Anytone percent to wire and approx watts', () => {
    const rows = listPowerLadderHints(50, [
      { formatId: 'anytone', profileId: 'anytone-at-d890uv' },
    ]);
    expect(rows[0]).toMatchObject({
      wire: 'Mid',
      approxWatts: '2.5 W',
      isRadioDefault: false,
    });
  });

  it('maps nearest OpenGD77 step for in-between percent', () => {
    const rows = listPowerLadderHints(55, [
      { formatId: 'opengd77', profileId: 'opengd77-1701' },
    ]);
    expect(rows[0]?.wire).toBe('P7');
    expect(rows[0]?.approxWatts).toBe('3 W');
  });

  it('shows DM32 wire label without inventing watts', () => {
    const rows = listPowerLadderHints(100, [
      { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' },
    ]);
    expect(rows[0]).toMatchObject({
      wire: 'High',
      isRadioDefault: false,
    });
    expect(rows[0]?.approxWatts).toBeUndefined();
  });

  it('maps CHIRP null to high wire with watts', () => {
    const rows = listPowerLadderHints(null, [{ formatId: 'chirp', profileId: 'chirp-uv5r' }]);
    expect(rows[0]).toMatchObject({
      wire: '5.0W',
      approxWatts: '5 W',
      isRadioDefault: true,
    });
  });
});

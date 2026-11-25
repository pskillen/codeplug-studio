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
    const rows = listPowerLadderHints(null, [{ formatId: 'opengd77', profileId: 'opengd77-1701' }]);
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

  it.each([
    [75, 'High', '5 W'],
    [100, 'High', '5 W'],
    [101, 'Turbo', '7 W VHF / 6 W UHF'],
    [null, 'High', '5 W'],
  ])('shows AT-D890UV power %s for stock and MM9PDY', (power, wire, approxWatts) => {
    const stock = { formatId: 'anytone', profileId: 'anytone-at-d890uv' } as const;
    const mod = { formatId: 'radio-io', profileId: 'radio-io-at-d890uv-mm9pdy' } as const;
    const projected = { wire, approxWatts, isRadioDefault: power === null };

    expect(
      listPowerLadderHints(power, [
        stock,
        { formatId: 'radio-io', profileId: 'radio-io-at-d890uv' },
      ]),
    ).toEqual([{ ...stock, label: 'Anytone AT-D890UV', ...projected }]);
    expect(listPowerLadderHints(power, [mod])).toEqual([
      { ...mod, label: 'Anytone AT-D890UV (MM9PDY modded firmware)', ...projected },
    ]);
  });

  it('shows the ordinary highest tier for Above High on radios without an extra tier', () => {
    const rows = listPowerLadderHints(101, [
      { formatId: 'opengd77', profileId: 'opengd77-1701' },
      { formatId: 'dm32', profileId: 'dm32-baofeng-dm32uv' },
      { formatId: 'chirp', profileId: 'chirp-rt95' },
      { formatId: 'anytone', profileId: 'anytone-at-d890uv' },
    ]);
    expect(rows.map(({ wire }) => wire)).toEqual(['P9', 'High', '25W', 'Turbo']);
  });

  it('maps nearest OpenGD77 step for in-between percent', () => {
    const rows = listPowerLadderHints(55, [{ formatId: 'opengd77', profileId: 'opengd77-1701' }]);
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

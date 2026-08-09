import { describe, expect, it } from 'vitest';
import { newSatellite } from '@core/domain/factories.ts';
import type { ParsedTleEntry } from '@core/domain/tle/tleTypes.ts';
import { mergeSatelliteSet } from './mergeSatelliteSet.ts';

const PROJECT_ID = 'project-1';

function entry(overrides: Partial<ParsedTleEntry> = {}): ParsedTleEntry {
  return {
    name: 'ISS (ZARYA)',
    noradId: 25544,
    tleLine1: '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993',
    tleLine2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001',
    epoch: '2024-02-14T12:25:40.104Z',
    classification: 'U',
    inclinationDeg: 51.6416,
    raanDeg: 247.4627,
    eccentricity: 0.0006703,
    argPerigeeDeg: 130.536,
    meanAnomalyDeg: 325.0288,
    meanMotionRevPerDay: 15.4956032,
    bstar: 0.00030589,
    elementSetNumber: 999,
    revolutionNumber: 43000,
    ...overrides,
  };
}

describe('mergeSatelliteSet', () => {
  it('adds new satellites not present in the existing set', () => {
    const result = mergeSatelliteSet([], [entry()], 'celestrak', PROJECT_ID);
    expect(result).toMatchObject({ added: 1, updated: 0, unchanged: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ noradId: 25544, enabled: true, source: 'celestrak' });
  });

  it('preserves id, enabled, and revision on an unchanged refresh', () => {
    const existing = newSatellite(PROJECT_ID, 'ISS (ZARYA)', 25544, {
      enabled: false,
      revision: 5,
    });
    const result = mergeSatelliteSet([existing], [entry()], 'celestrak', PROJECT_ID);

    expect(result).toMatchObject({ added: 0, updated: 0, unchanged: 1 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: existing.id,
      enabled: false,
      revision: 5,
    });
  });

  it('counts an updated row when the TLE lines changed, still preserving enabled', () => {
    const existing = newSatellite(PROJECT_ID, 'ISS (ZARYA)', 25544, { enabled: false });
    const refreshed = entry({
      tleLine1: '1 25544U 98067A   24046.51782528  .00016717 00000-0   30589-3 0  9993',
    });
    const result = mergeSatelliteSet([existing], [refreshed], 'celestrak', PROJECT_ID);

    expect(result).toMatchObject({ added: 0, updated: 1, unchanged: 0 });
    expect(result.rows[0]).toMatchObject({
      id: existing.id,
      enabled: false,
      tleLine1: refreshed.tleLine1,
    });
  });

  it('keeps satellites missing from a fresh fetch rather than deleting them', () => {
    const gone = newSatellite(PROJECT_ID, 'Retired Sat', 99999);
    const result = mergeSatelliteSet([gone], [entry()], 'celestrak', PROJECT_ID);

    expect(result.rows).toHaveLength(2);
    expect(result.rows.some((row) => row.noradId === 99999)).toBe(true);
    expect(result.added).toBe(1);
  });
});

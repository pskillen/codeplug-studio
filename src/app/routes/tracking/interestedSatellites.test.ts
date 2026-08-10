import { describe, expect, it } from 'vitest';
import type { Satellite } from '@core/models/satellite.ts';
import {
  computeInterestedSatelliteIds,
  computeFrequencyQualifiedSatelliteIds,
  hasSatelliteInterestFilter,
} from './interestedSatellites.ts';

function satellite(id: string, noradId: number, uplinkHz: number | null = null): Satellite {
  return {
    id,
    projectId: 'project-1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: id,
    noradId,
    enabled: true,
    source: 'celestrak',
    tleLine1: '1',
    tleLine2: '2',
    epoch: '2026-01-01T00:00:00.000Z',
    classification: 'U',
    inclinationDeg: 0,
    raanDeg: 0,
    eccentricity: 0,
    argPerigeeDeg: 0,
    meanAnomalyDeg: 0,
    meanMotionRevPerDay: 15,
    bstar: 0,
    elementSetNumber: 1,
    revolutionNumber: 1,
    uplinkHz,
    downlinkHz: null,
  };
}

describe('computeFrequencyQualifiedSatelliteIds', () => {
  it('includes satellites with library uplink/downlink set', () => {
    const ids = computeFrequencyQualifiedSatelliteIds([satellite('a', 1, 145_990_000)], () => null);
    expect([...ids]).toEqual(['a']);
  });

  it('includes satellites with SatNOGS transmitter frequencies', () => {
    const ids = computeFrequencyQualifiedSatelliteIds([satellite('b', 2)], (noradId) =>
      noradId === 2
        ? {
            noradId: 2,
            source: 'satnogs',
            fetchedAt: '2026-08-10T12:00:00.000Z',
            transmitters: [
              {
                uuid: 'x',
                description: 'FM',
                mode: 'FM',
                uplinkHz: null,
                downlinkHz: 145_800_000,
                alive: true,
                status: 'active',
              },
            ],
          }
        : null,
    );
    expect([...ids]).toEqual(['b']);
  });
});

describe('computeInterestedSatelliteIds', () => {
  const enabled = new Set(['a', 'b', 'c']);
  const withFreq = new Set(['a', 'b']);

  it('returns all enabled satellites when no satellite filters are active', () => {
    expect(computeInterestedSatelliteIds(enabled, withFreq, new Set(), false)).toEqual(enabled);
  });

  it('intersects with frequency-qualified ids when the frequency toggle is on', () => {
    expect(computeInterestedSatelliteIds(enabled, withFreq, new Set(), true)).toEqual(withFreq);
  });

  it('intersects with the multi-select filter when set', () => {
    expect(computeInterestedSatelliteIds(enabled, withFreq, new Set(['b']), true)).toEqual(
      new Set(['b']),
    );
  });
});

describe('hasSatelliteInterestFilter', () => {
  it('is true when frequency filter or multi-select is active', () => {
    expect(hasSatelliteInterestFilter(true, new Set())).toBe(true);
    expect(hasSatelliteInterestFilter(false, new Set(['a']))).toBe(true);
    expect(hasSatelliteInterestFilter(false, new Set())).toBe(false);
  });
});

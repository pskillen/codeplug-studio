import { describe, expect, it } from 'vitest';
import {
  computeGlobeTrailPaths,
  filterGlobeSatellitesByInterest,
  stabilizeGlobePointsAndFootprints,
  type GlobePoint,
  type GlobePointsAndFootprints,
} from './buildGlobeData.ts';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';
const ANCHOR_MS = new Date('2024-02-14T18:00:00.000Z').getTime();

const satelliteA = {
  id: 'a',
  name: 'A',
  noradId: 25544,
  tleLine1: ISS_LINE_1,
  tleLine2: ISS_LINE_2,
  meanMotionRevPerDay: 15.4956032,
};

const satelliteB = {
  id: 'b',
  name: 'B',
  noradId: 2,
  tleLine1: '3',
  tleLine2: '4',
  meanMotionRevPerDay: 14,
};

describe('computeGlobeTrailPaths', () => {
  it('returns past and future paths per satellite with opaque base colours', () => {
    const paths = computeGlobeTrailPaths([satelliteA], ANCHOR_MS, {
      lookBehindMin: 15,
      lookAheadMin: 30,
    });

    expect(paths).toHaveLength(2);
    const past = paths.find((p) => p.kind === 'trail-past');
    const future = paths.find((p) => p.kind === 'trail-future');
    expect(past?.points.length).toBeGreaterThan(1);
    expect(future?.points.length).toBeGreaterThan(1);
    expect(past?.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(future?.color).toBe(past?.color);
  });
});

describe('filterGlobeSatellitesByInterest', () => {
  it('returns only interested satellites', () => {
    const result = filterGlobeSatellitesByInterest([satelliteA, satelliteB], new Set(['a', 'b']));
    expect(result).toHaveLength(2);
  });

  it('omits satellites outside the interest set', () => {
    const result = filterGlobeSatellitesByInterest([satelliteA, satelliteB], new Set(['a']));
    expect(result.map((s) => s.id)).toEqual(['a']);
  });
});

describe('stabilizeGlobePointsAndFootprints', () => {
  const point: GlobePoint = {
    kind: 'satellite',
    id: 'iss',
    name: 'ISS',
    lat: 10,
    lng: 20,
    altitudeKm: 400,
    selected: true,
    color: '#c45a2a',
  };

  const geometry: GlobePointsAndFootprints = {
    points: [point],
    footprintPaths: [
      {
        kind: 'footprint',
        satelliteId: 'iss',
        color: 'rgba(196, 90, 42, 0.45)',
        points: [
          [10, 20, 0],
          [11, 21, 0],
        ],
      },
    ],
  };

  it('returns next geometry when there is no previous snapshot', () => {
    expect(stabilizeGlobePointsAndFootprints(geometry, null)).toBe(geometry);
  });

  it('reuses point and path references when values are unchanged', () => {
    const next: GlobePointsAndFootprints = {
      points: [{ ...point }],
      footprintPaths: [
        {
          kind: 'footprint',
          satelliteId: 'iss',
          color: 'rgba(196, 90, 42, 0.45)',
          points: [
            [10, 20, 0],
            [11, 21, 0],
          ],
        },
      ],
    };
    const stabilized = stabilizeGlobePointsAndFootprints(next, geometry);
    expect(stabilized.points[0]).toBe(geometry.points[0]);
    expect(stabilized.footprintPaths[0]).toBe(geometry.footprintPaths[0]);
  });
});

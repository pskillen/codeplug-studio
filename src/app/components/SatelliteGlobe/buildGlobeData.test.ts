import { describe, expect, it } from 'vitest';
import {
  filterGlobeSatellitesByInterest,
  stabilizeGlobePointsAndFootprints,
  type GlobePoint,
  type GlobePointsAndFootprints,
} from './buildGlobeData.ts';

const satelliteA = {
  id: 'a',
  name: 'A',
  noradId: 1,
  tleLine1: '1',
  tleLine2: '2',
  meanMotionRevPerDay: 15,
};

const satelliteB = {
  id: 'b',
  name: 'B',
  noradId: 2,
  tleLine1: '3',
  tleLine2: '4',
  meanMotionRevPerDay: 14,
};

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

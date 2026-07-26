import { describe, expect, it } from 'vitest';
import type { Channel } from '../models/library.ts';
import { newChannel } from './factories.ts';
import { pointInConvexHull } from './geo.ts';
import {
  pointInZoneHull,
  rankChannelsByDistance,
  suggestChannelsInsideHull,
  zoneCentreFromPoints,
  ZONE_HULL_SINGLE_SITE_RADIUS_M,
} from './growZone.ts';
import { haversineDistanceM } from './geoDistance.ts';

const PROJECT_ID = 'proj-test';

function locatedChannel(
  name: string,
  lat: number,
  lon: number,
  overrides: Partial<Channel> = {},
): Channel {
  return {
    ...newChannel(PROJECT_ID, name),
    useLocation: true,
    location: { lat, lon },
    ...overrides,
  };
}

describe('pointInConvexHull', () => {
  const square: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 1],
    [1, 0],
  ];

  it('returns true for interior and boundary points', () => {
    expect(pointInConvexHull([0.5, 0.5], square)).toBe(true);
    expect(pointInConvexHull([0, 0.5], square)).toBe(true);
  });

  it('returns false for exterior points', () => {
    expect(pointInConvexHull([2, 2], square)).toBe(false);
  });

  it('returns false when hull has fewer than three vertices', () => {
    expect(
      pointInConvexHull(
        [0.5, 0.5],
        [
          [0, 0],
          [1, 1],
        ],
      ),
    ).toBe(false);
  });
});

describe('zoneCentreFromPoints', () => {
  it('returns null for empty input', () => {
    expect(zoneCentreFromPoints([])).toBeNull();
  });

  it('returns arithmetic mean of points', () => {
    expect(
      zoneCentreFromPoints([
        [10, 20],
        [20, 40],
      ]),
    ).toEqual({ lat: 15, lon: 30 });
  });
});

describe('pointInZoneHull', () => {
  const centre: [number, number] = [55.8642, -4.2518];

  it('returns false for zero member points', () => {
    expect(pointInZoneHull(centre, [])).toBe(false);
  });

  it('uses 2.5 km circle for a single member site', () => {
    const inside = haversineDistanceM(centre[0], centre[1], centre[0] + 0.01, centre[1]);
    expect(inside).toBeLessThan(ZONE_HULL_SINGLE_SITE_RADIUS_M);
    expect(pointInZoneHull([centre[0] + 0.01, centre[1]], [centre])).toBe(true);

    const far = haversineDistanceM(centre[0], centre[1], centre[0] + 0.5, centre[1]);
    expect(far).toBeGreaterThan(ZONE_HULL_SINGLE_SITE_RADIUS_M);
    expect(pointInZoneHull([centre[0] + 0.5, centre[1]], [centre])).toBe(false);
  });

  it('returns false for two member sites (line geometry has no area)', () => {
    const twoSites: [number, number][] = [
      [55.86, -4.25],
      [55.87, -4.24],
    ];
    expect(pointInZoneHull([55.865, -4.245], twoSites)).toBe(false);
  });

  it('uses convex hull for three or more member sites', () => {
    const triangle: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
    ];
    expect(pointInZoneHull([0.2, 0.2], triangle)).toBe(true);
    expect(pointInZoneHull([2, 2], triangle)).toBe(false);
  });
});

describe('suggestChannelsInsideHull', () => {
  const triangle: [number, number][] = [
    [0, 0],
    [0, 1],
    [1, 0],
  ];

  it('returns empty for two member sites', () => {
    const inside = locatedChannel('Inside', 0.2, 0.2);
    const result = suggestChannelsInsideHull([inside], new Set(), [
      [0, 0],
      [1, 1],
    ]);
    expect(result.channelIds).toEqual([]);
  });

  it('excludes members and channels without geolocation', () => {
    const member = locatedChannel('Member', 0.2, 0.2);
    const inside = locatedChannel('Inside', 0.3, 0.3);
    const outside = locatedChannel('Outside', 2, 2);
    const noGeo = newChannel(PROJECT_ID, 'No geo');

    const result = suggestChannelsInsideHull(
      [member, inside, outside, noGeo],
      new Set([member.id]),
      triangle,
    );
    expect(result.channelIds).toEqual([inside.id]);
  });
});

describe('rankChannelsByDistance', () => {
  const centre = { lat: 55.8642, lon: -4.2518 };

  it('ranks non-member geolocated channels nearest first', () => {
    const member = locatedChannel('Member', centre.lat, centre.lon);
    const near = locatedChannel('Near', centre.lat + 0.01, centre.lon);
    const far = locatedChannel('Far', centre.lat + 0.5, centre.lon);

    const result = rankChannelsByDistance([member, near, far], new Set([member.id]), centre);
    expect(result.channelIds).toEqual([near.id, far.id]);
    expect(result.distancesM.get(near.id)).toBeLessThan(result.distancesM.get(far.id)!);
  });

  it('tie-breaks equal distances by channel name', () => {
    const a = locatedChannel('Alpha', centre.lat + 0.01, centre.lon);
    const b = locatedChannel('Bravo', centre.lat + 0.01, centre.lon);
    const result = rankChannelsByDistance([b, a], new Set(), centre);
    expect(result.channelIds).toEqual([a.id, b.id]);
  });
});

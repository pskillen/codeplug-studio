import { describe, expect, it } from 'vitest';
import {
  coveringLocatorSquares,
  formatBearingLabel,
  formatCoordParam,
  formatDistanceInUnit,
  formatLocatorDisplay,
  locatorSquareBounds,
  parseLatLon,
  rankByDistance,
} from './fieldGeo.ts';
import { locatorToCoords } from './maidenhead.ts';

const glasgow = { lat: 55.8642, lon: -4.2518 };

describe('rankByDistance', () => {
  const items = [
    { id: 'far', p: { lat: 56.5, lon: -4.0 } },
    { id: 'near', p: { lat: 55.87, lon: -4.26 } },
    { id: 'none', p: null },
    { id: 'mid', p: { lat: 55.95, lon: -3.19 } },
  ];

  it('sorts nearest first and drops items without a location', () => {
    const r = rankByDistance(items, glasgow, (i) => i.p, 200_000);
    expect(r.map((x) => x.item.id)).toEqual(['near', 'mid', 'far']);
    expect(r[0].distanceM).toBeLessThan(1000);
  });

  it('applies the radius and gives a bearing', () => {
    const r = rankByDistance(items, glasgow, (i) => i.p, 20_000);
    expect(r.map((x) => x.item.id)).toEqual(['near']);
    const mid = rankByDistance(items, glasgow, (i) => i.p, 100_000).find(
      (x) => x.item.id === 'mid',
    );
    expect(mid?.bearingDeg).toBeGreaterThan(60);
    expect(mid?.bearingDeg).toBeLessThan(100);
  });
});

describe('formatting', () => {
  it('formats distances in the chosen unit', () => {
    expect(formatDistanceInUnit(1609.344 * 7.2, 'mi')).toBe('7.2 mi');
    expect(formatDistanceInUnit(11_600, 'km')).toBe('11.6 km');
    expect(formatDistanceInUnit(120, 'mi')).toBe('120 m');
    expect(formatDistanceInUnit(Number.NaN, 'km')).toBe('—');
  });

  it('formats bearings with compass point', () => {
    expect(formatBearingLabel(146)).toBe('146° SE');
    expect(formatBearingLabel(359.7)).toBe('0° N');
  });
});

describe('locatorSquareBounds', () => {
  it('returns a box around the locator centre', () => {
    const b = locatorSquareBounds('IO75ui')!;
    const c = locatorToCoords('IO75ui')!;
    expect(c.lat).toBeGreaterThan(b.south);
    expect(c.lat).toBeLessThan(b.north);
    expect(c.lon).toBeGreaterThan(b.west);
    expect(c.lon).toBeLessThan(b.east);
    expect(b.north - b.south).toBeCloseTo(1 / 24, 6);
  });

  it('handles 4 characters and rejects invalid input', () => {
    const b = locatorSquareBounds('IO75')!;
    expect(b.east - b.west).toBeCloseTo(2, 6);
    expect(locatorSquareBounds('nope')).toBeNull();
  });
});

describe('coveringLocatorSquares', () => {
  it('includes the home square and neighbours for a large radius', () => {
    const s = coveringLocatorSquares(glasgow, 40_000);
    expect(s).toContain('IO75');
    expect(s.length).toBeGreaterThan(1);
  });

  it('returns just the home square for a tiny radius', () => {
    expect(coveringLocatorSquares(glasgow, 500)).toEqual(['IO75']);
  });
});

describe('point params', () => {
  it('parses valid pairs and rejects bad ones', () => {
    expect(parseLatLon('55.5', '-4.2')).toEqual({ lat: 55.5, lon: -4.2 });
    expect(parseLatLon('abc', '1')).toBeNull();
    expect(parseLatLon('91', '1')).toBeNull();
    expect(parseLatLon(null, '1')).toBeNull();
    expect(parseLatLon('', '')).toBeNull();
  });

  it('rounds coordinates for URLs', () => {
    expect(formatCoordParam(55.8642123456)).toBe('55.86421');
  });
});

describe('formatLocatorDisplay', () => {
  it('applies conventional casing', () => {
    expect(formatLocatorDisplay('IO75UI')).toBe('IO75ui');
    expect(formatLocatorDisplay('io75ui23')).toBe('IO75ui23');
    expect(formatLocatorDisplay('io75')).toBe('IO75');
    expect(formatLocatorDisplay('IO75UI23AB')).toBe('IO75ui23ab');
  });
});

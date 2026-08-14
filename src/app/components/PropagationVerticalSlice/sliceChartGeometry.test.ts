import { describe, expect, it } from 'vitest';
import { haversineDistanceM } from '@core/domain/geoDistance.ts';
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  MAX_ALTITUDE_KM,
  cumulativeDistancesM,
  xForDistanceM,
  yForAltitudeKm,
} from './sliceChartGeometry.ts';

describe('cumulativeDistancesM', () => {
  it('returns an empty list for no points', () => {
    expect(cumulativeDistancesM([])).toEqual([]);
  });

  it('starts at 0 and accumulates haversine segments', () => {
    const a = { lat: 0, lon: 0 };
    const b = { lat: 0, lon: 1 };
    const c = { lat: 1, lon: 1 };
    const distances = cumulativeDistancesM([a, b, c]);
    const ab = haversineDistanceM(a.lat, a.lon, b.lat, b.lon);
    const bc = haversineDistanceM(b.lat, b.lon, c.lat, c.lon);
    expect(distances).toHaveLength(3);
    expect(distances[0]).toBe(0);
    expect(distances[1]).toBeCloseTo(ab);
    expect(distances[2]).toBeCloseTo(ab + bc);
  });
});

describe('xForDistanceM', () => {
  it('maps 0 to the left edge and maxRange to the right edge', () => {
    expect(xForDistanceM(0, 4_000_000)).toBe(0);
    expect(xForDistanceM(4_000_000, 4_000_000)).toBe(CHART_WIDTH);
    expect(xForDistanceM(2_000_000, 4_000_000)).toBe(CHART_WIDTH / 2);
  });

  it('clamps beyond maxRangeM and treats a non-positive range as x=0', () => {
    expect(xForDistanceM(8_000_000, 4_000_000)).toBe(CHART_WIDTH);
    expect(xForDistanceM(100, 0)).toBe(0);
    expect(xForDistanceM(-50, 4_000_000)).toBe(0);
  });
});

describe('yForAltitudeKm', () => {
  it('maps the surface to the bottom and MAX_ALTITUDE_KM to the top', () => {
    expect(yForAltitudeKm(0)).toBe(CHART_HEIGHT);
    expect(yForAltitudeKm(MAX_ALTITUDE_KM)).toBe(0);
    expect(yForAltitudeKm(MAX_ALTITUDE_KM / 2)).toBe(CHART_HEIGHT / 2);
  });

  it('clamps below 0 and above MAX_ALTITUDE_KM', () => {
    expect(yForAltitudeKm(-10)).toBe(CHART_HEIGHT);
    expect(yForAltitudeKm(MAX_ALTITUDE_KM + 50)).toBe(0);
  });
});

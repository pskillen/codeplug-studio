import { describe, expect, it } from 'vitest';
import { locatorToCoords } from './maidenhead.ts';
import {
  compassOctant,
  destinationPoint,
  formatDistanceKmAndMi,
  formatDistanceM,
  haversineDistanceM,
  initialBearingDeg,
  pathMetricsBetween,
  reciprocalBearingDeg,
} from './geoDistance.ts';

describe('geoDistance', () => {
  it('computes distance between known locator centres', () => {
    const london = locatorToCoords('IO91WM');
    const amsterdam = locatorToCoords('JO22');
    expect(london).not.toBeNull();
    expect(amsterdam).not.toBeNull();
    if (!london || !amsterdam) return;

    const metrics = pathMetricsBetween(london, amsterdam);
    // London ↔ Amsterdam ≈ 350–400 km by great circle.
    expect(metrics.distanceM).toBeGreaterThan(320_000);
    expect(metrics.distanceM).toBeLessThan(420_000);
  });

  it('computes initial bearing London → Amsterdam roughly east', () => {
    const london = locatorToCoords('IO91WM');
    const amsterdam = locatorToCoords('JO22');
    expect(london).not.toBeNull();
    expect(amsterdam).not.toBeNull();
    if (!london || !amsterdam) return;

    const bearing = initialBearingDeg(london.lat, london.lon, amsterdam.lat, amsterdam.lon);
    expect(bearing).toBeGreaterThan(70);
    expect(bearing).toBeLessThan(110);
    expect(compassOctant(bearing)).toBe('E');
  });

  it('reciprocal bearing differs by 180°', () => {
    expect(reciprocalBearingDeg(45)).toBeCloseTo(225, 5);
    expect(reciprocalBearingDeg(350)).toBeCloseTo(170, 5);
    expect(reciprocalBearingDeg(0)).toBeCloseTo(180, 5);
  });

  it('formats distance in metres and kilometres', () => {
    expect(formatDistanceM(450)).toBe('450 m');
    expect(formatDistanceM(12_500)).toBe('12.5 km');
    expect(formatDistanceM(-1)).toBe('—');
  });

  it('formats distance with miles', () => {
    expect(formatDistanceKmAndMi(1609.344)).toBe('1.6 km (1.0 mi)');
    expect(formatDistanceKmAndMi(500)).toBe('500 m (0.3 mi)');
  });

  it('pathMetricsBetween returns reciprocal bearing', () => {
    const a = { lat: 51.5, lon: -0.1 };
    const b = { lat: 52.37, lon: 4.9 };
    const metrics = pathMetricsBetween(a, b);
    expect(metrics.bearingBA).toBeCloseTo(reciprocalBearingDeg(metrics.bearingAB), 5);
  });

  it('destinationPoint at the equator due east by 1° of longitude', () => {
    const oneDegreeM = 6_371_000 * (Math.PI / 180);
    const dest = destinationPoint(0, 0, 90, oneDegreeM);
    expect(dest.lat).toBeCloseTo(0, 10);
    expect(dest.lon).toBeCloseTo(1, 10);
  });

  it('destinationPoint round-trips pathMetricsBetween (London → Amsterdam)', () => {
    const from = { lat: 51.5, lon: -0.1 };
    const to = { lat: 52.37, lon: 4.9 };
    const distanceM = haversineDistanceM(from.lat, from.lon, to.lat, to.lon);
    const bearingDeg = initialBearingDeg(from.lat, from.lon, to.lat, to.lon);
    const dest = destinationPoint(from.lat, from.lon, bearingDeg, distanceM);
    expect(distanceM).toBeCloseTo(356_094.5, 0);
    expect(bearingDeg).toBeCloseTo(72.281, 3);
    expect(dest.lat).toBeCloseTo(to.lat, 10);
    expect(dest.lon).toBeCloseTo(to.lon, 10);
  });

  it('destinationPoint at zero distance returns the start', () => {
    const dest = destinationPoint(51.5, -0.13, 45, 0);
    expect(dest.lat).toBeCloseTo(51.5, 10);
    expect(dest.lon).toBeCloseTo(-0.13, 10);
  });
});

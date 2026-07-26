import { describe, expect, it } from 'vitest';
import { locatorToCoords } from './maidenhead.ts';
import {
  compassOctant,
  formatDistanceKmAndMi,
  formatDistanceM,
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
});

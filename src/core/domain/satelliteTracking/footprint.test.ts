import { describe, expect, it } from 'vitest';
import {
  computeSatelliteFootprint,
  footprintAngularRadiusDeg,
  sampleGreatCircle,
} from './footprint.ts';

const ISS_LINE_1 = '1 25544U 98067A   24045.51782528  .00016717 00000-0   30589-3 0  9993';
const ISS_LINE_2 = '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.4956032 430001';

describe('footprintAngularRadiusDeg', () => {
  it('matches acos(Re / (Re + altitude)) for an ISS-like ~400km altitude', () => {
    // acos(6371 / 6771) in degrees, computed by hand from the same formula.
    expect(footprintAngularRadiusDeg(400)).toBeCloseTo(19.79, 1);
  });

  it('matches the formula for a geostationary-like ~35,786km altitude', () => {
    // acos(6371 / 42157) in degrees.
    expect(footprintAngularRadiusDeg(35786)).toBeCloseTo(81.31, 1);
  });

  it('grows monotonically with altitude', () => {
    const low = footprintAngularRadiusDeg(400);
    const mid = footprintAngularRadiusDeg(2000);
    const high = footprintAngularRadiusDeg(35786);
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it('is near zero at a very low (near-zero) altitude', () => {
    expect(footprintAngularRadiusDeg(0.001)).toBeCloseTo(0, 1);
  });

  it('does not throw or produce NaN at a very high altitude', () => {
    const radius = footprintAngularRadiusDeg(1_000_000);
    expect(Number.isFinite(radius)).toBe(true);
    expect(radius).toBeGreaterThan(0);
    expect(radius).toBeLessThan(90);
  });

  it('clamps non-positive altitude instead of feeding acos an out-of-domain ratio', () => {
    expect(() => footprintAngularRadiusDeg(0)).not.toThrow();
    expect(() => footprintAngularRadiusDeg(-10)).not.toThrow();
    expect(Number.isFinite(footprintAngularRadiusDeg(-10))).toBe(true);
  });
});

describe('sampleGreatCircle', () => {
  it('produces a closed ring (first point equals last point)', () => {
    const points = sampleGreatCircle(0, 0, 20, 36);
    expect(points[0]).toEqual(points[points.length - 1]);
  });

  it('produces pointCount + 1 points', () => {
    const points = sampleGreatCircle(10, -50, 15, 24);
    expect(points).toHaveLength(25);
  });

  it('keeps every sampled point roughly equidistant (angularly) from the center', () => {
    const centerLat = 30;
    const centerLon = -40;
    const radiusDeg = 20;
    const points = sampleGreatCircle(centerLat, centerLon, radiusDeg, 48);

    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const centerLatRad = toRad(centerLat);
    const centerLonRad = toRad(centerLon);

    for (const [lat, lon] of points) {
      const latRad = toRad(lat);
      const lonRad = toRad(lon);
      // Spherical law of cosines for great-circle angular distance.
      const cosAngle =
        Math.sin(centerLatRad) * Math.sin(latRad) +
        Math.cos(centerLatRad) * Math.cos(latRad) * Math.cos(lonRad - centerLonRad);
      const angularDistanceDeg = (Math.acos(Math.min(1, Math.max(-1, cosAngle))) * 180) / Math.PI;
      expect(angularDistanceDeg).toBeCloseTo(radiusDeg, 1);
    }
  });

  it('stays within valid lat/lon bounds even near the pole', () => {
    const points = sampleGreatCircle(85, 0, 10, 36);
    for (const [lat, lon] of points) {
      expect(lat).toBeGreaterThanOrEqual(-90);
      expect(lat).toBeLessThanOrEqual(90);
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
    }
  });
});

describe('computeSatelliteFootprint', () => {
  it('returns a footprint centered on the subsatellite point with a plausible LEO radius', () => {
    const footprint = computeSatelliteFootprint(ISS_LINE_1, ISS_LINE_2, '2024-02-14T18:00:00.000Z');

    expect(footprint).not.toBeNull();
    const { center, altitudeKm, angularRadiusDeg, points } = footprint!;
    expect(center[0]).toBeGreaterThanOrEqual(-90);
    expect(center[0]).toBeLessThanOrEqual(90);
    expect(center[1]).toBeGreaterThanOrEqual(-180);
    expect(center[1]).toBeLessThanOrEqual(180);
    // ISS orbits at roughly 400-420km.
    expect(altitudeKm).toBeGreaterThan(300);
    expect(altitudeKm).toBeLessThan(500);
    expect(angularRadiusDeg).toBeCloseTo(footprintAngularRadiusDeg(altitudeKm), 6);
    expect(points.length).toBeGreaterThan(1);
    expect(points[0]).toEqual(points[points.length - 1]);
  });

  it('respects a custom point count', () => {
    const footprint = computeSatelliteFootprint(
      ISS_LINE_1,
      ISS_LINE_2,
      '2024-02-14T18:00:00.000Z',
      12,
    );
    expect(footprint!.points).toHaveLength(13);
  });
});

import { describe, expect, it } from 'vitest';
import { haversineDistanceM } from '../geoDistance.ts';
import {
  computePropagationRing,
  GROUNDWAVE_MAX_RANGE_KM,
  skipZoneOuterRadiusM,
} from './footprint.ts';
import type { RayPathResult } from './types.ts';

describe('computePropagationRing', () => {
  it('returns pointCount + 1 samples so the ring closes (first === last bearing)', () => {
    const ring = computePropagationRing(0, 0, 300_000, 72);
    expect(ring).toHaveLength(73);
    expect(ring[0]?.[0]).toBeCloseTo(ring[72]![0]!);
    expect(ring[0]?.[1]).toBeCloseTo(ring[72]![1]!);
  });

  it('places samples at the requested radius from the transmitter', () => {
    const txLat = 10;
    const txLon = 20;
    const radiusM = 500_000;
    const ring = computePropagationRing(txLat, txLon, radiusM, 8);
    for (const [lat, lon] of ring) {
      expect(haversineDistanceM(txLat, txLon, lat, lon)).toBeCloseTo(radiusM, -2);
    }
  });
});

describe('skipZoneOuterRadiusM', () => {
  const txLat = 0;
  const txLon = 0;

  function ray(mode: RayPathResult['mode'], landingLat: number): RayPathResult {
    return {
      mode,
      points: [
        { lat: txLat, lon: txLon, altitudeKm: 0 },
        { lat: landingLat / 2, lon: 0, altitudeKm: 250 },
        { lat: landingLat, lon: 0, altitudeKm: 0 },
      ],
      takeoffAngleDeg: mode === 'nvis' ? 80 : 20,
      relativeSignalStrength: 1,
    };
  }

  it('returns the nearest skywave/NVIS landing distance', () => {
    const far = ray('skywave', 20);
    const near = ray('nvis', 5);
    const radius = skipZoneOuterRadiusM([far, near, ray('groundwave', 2)], txLat, txLon);
    const expected = haversineDistanceM(txLat, txLon, 5, 0);
    expect(radius).toBeCloseTo(expected);
  });

  it('returns null when no skywave or NVIS ray exists', () => {
    expect(skipZoneOuterRadiusM([ray('groundwave', 2), ray('escaped', 40)], txLat, txLon)).toBeNull();
  });

  it('re-exports the groundwave inner-edge constant', () => {
    expect(GROUNDWAVE_MAX_RANGE_KM).toBe(300);
  });
});

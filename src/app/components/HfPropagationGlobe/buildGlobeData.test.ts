import { describe, expect, it } from 'vitest';
import { GLOBE_EARTH_RADIUS_KM } from '../SatelliteGlobe/globeAltitude.ts';
import {
  displayShellRadiusUnits,
  EXPLODE_OFFSET_PER_LAYER,
  exaggeratedAltitudeKm,
  explodeOffsetUnits,
  GLOBE_RADIUS_UNITS,
  shellRadiusUnits,
} from './buildGlobeData.ts';

describe('exaggeratedAltitudeKm', () => {
  it('is a no-op at factor 1', () => {
    expect(exaggeratedAltitudeKm(100, 1)).toBe(100);
  });

  it('multiplies altitude at factor 5', () => {
    expect(exaggeratedAltitudeKm(100, 5)).toBe(500);
  });

  it('does not shrink altitude when factor is below 1×', () => {
    expect(exaggeratedAltitudeKm(100, 0.5)).toBe(100);
  });

  it('is a no-op for non-finite factors', () => {
    expect(exaggeratedAltitudeKm(100, Number.NaN)).toBe(100);
    expect(exaggeratedAltitudeKm(100, Number.POSITIVE_INFINITY)).toBe(100);
  });
});

describe('explodeOffsetUnits', () => {
  it('returns 0 for the innermost layer when enabled', () => {
    expect(explodeOffsetUnits(0, true)).toBe(0);
  });

  it('returns index × OFFSET_PER_LAYER for the outermost layer when enabled', () => {
    expect(explodeOffsetUnits(3, true)).toBe(3 * EXPLODE_OFFSET_PER_LAYER);
  });

  it('returns 0 when exploded stacking is disabled', () => {
    expect(explodeOffsetUnits(0, false)).toBe(0);
    expect(explodeOffsetUnits(3, false)).toBe(0);
  });
});

describe('displayShellRadiusUnits', () => {
  const trueScale = { exaggerationFactor: 1, explodeEnabled: false };

  it('matches shellRadiusUnits at true scale', () => {
    expect(displayShellRadiusUnits(100, 2, trueScale)).toBe(shellRadiusUnits(100));
  });

  it('scales altitude by the exaggeration factor', () => {
    const midAltitudeKm = 100;
    expect(displayShellRadiusUnits(midAltitudeKm, 0, { exaggerationFactor: 5, explodeEnabled: false })).toBeCloseTo(
      GLOBE_RADIUS_UNITS * (1 + (midAltitudeKm * 5) / GLOBE_EARTH_RADIUS_KM),
    );
  });

  it('adds explode offset in globe-radius units before converting to scene units', () => {
    const midAltitudeKm = 100;
    expect(
      displayShellRadiusUnits(midAltitudeKm, 3, { exaggerationFactor: 1, explodeEnabled: true }),
    ).toBeCloseTo(
      GLOBE_RADIUS_UNITS *
        (1 + midAltitudeKm / GLOBE_EARTH_RADIUS_KM + 3 * EXPLODE_OFFSET_PER_LAYER),
    );
  });
});

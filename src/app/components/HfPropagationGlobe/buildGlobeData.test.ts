import { describe, expect, it } from 'vitest';
import { GLOBE_EARTH_RADIUS_KM } from '../SatelliteGlobe/globeAltitude.ts';
import {
  canonicalLayerIndex,
  displayShellRadiusUnits,
  EXPLODE_OFFSET_PER_LAYER,
  exaggeratedAltitudeKm,
  explodeOffsetUnits,
  FRESNEL_OPACITY_MAX,
  FRESNEL_OPACITY_MIN,
  fresnelOpacity,
  GLOBE_RADIUS_UNITS,
  SHELL_INNER_BASELINE_OPACITY,
  SHELL_OPACITY_STEP,
  shellBaselineOpacity,
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
  const trueScale = { exaggerationFactor: 1, explodeEnabled: false, fresnelEnabled: false };

  it('matches shellRadiusUnits at true scale', () => {
    expect(displayShellRadiusUnits(100, 2, trueScale)).toBe(shellRadiusUnits(100));
  });

  it('scales altitude by the exaggeration factor', () => {
    const midAltitudeKm = 100;
    expect(
      displayShellRadiusUnits(midAltitudeKm, 0, {
        exaggerationFactor: 5,
        explodeEnabled: false,
        fresnelEnabled: false,
      }),
    ).toBeCloseTo(GLOBE_RADIUS_UNITS * (1 + (midAltitudeKm * 5) / GLOBE_EARTH_RADIUS_KM));
  });

  it('uses canonical layer index so F2 still gets the outermost explode offset at night', () => {
    const midAltitudeKm = 325;
    expect(
      displayShellRadiusUnits(midAltitudeKm, 3, {
        exaggerationFactor: 1,
        explodeEnabled: true,
        fresnelEnabled: false,
      }),
    ).toBeCloseTo(
      GLOBE_RADIUS_UNITS *
        (1 + midAltitudeKm / GLOBE_EARTH_RADIUS_KM + 3 * EXPLODE_OFFSET_PER_LAYER),
    );
  });
});

describe('canonicalLayerIndex', () => {
  it('is D=0 … F2=3 regardless of draw order', () => {
    expect(canonicalLayerIndex('D')).toBe(0);
    expect(canonicalLayerIndex('E')).toBe(1);
    expect(canonicalLayerIndex('F1')).toBe(2);
    expect(canonicalLayerIndex('F2')).toBe(3);
  });

  it('keeps E and F2 indices when D and F1 are absent (night)', () => {
    const nightActive = ['E', 'F2'] as const;
    expect(nightActive.indexOf('F2')).toBe(1);
    expect(canonicalLayerIndex('E')).toBe(1);
    expect(canonicalLayerIndex('F2')).toBe(3);
    expect(explodeOffsetUnits(canonicalLayerIndex('F2'), true)).toBe(3 * EXPLODE_OFFSET_PER_LAYER);
    expect(explodeOffsetUnits(canonicalLayerIndex('F2'), true)).not.toBe(
      explodeOffsetUnits(nightActive.indexOf('F2'), true),
    );
  });
});

describe('shellBaselineOpacity', () => {
  it('steps opacity down from inner D to outer F2', () => {
    expect(shellBaselineOpacity(0)).toBe(SHELL_INNER_BASELINE_OPACITY);
    expect(shellBaselineOpacity(1)).toBe(SHELL_INNER_BASELINE_OPACITY - SHELL_OPACITY_STEP);
    expect(shellBaselineOpacity(2)).toBe(SHELL_INNER_BASELINE_OPACITY - 2 * SHELL_OPACITY_STEP);
    expect(shellBaselineOpacity(3)).toBe(SHELL_INNER_BASELINE_OPACITY - 3 * SHELL_OPACITY_STEP);
  });
});

describe('fresnelOpacity', () => {
  it('is at the minimum when looking face-on (|N·V| = 1)', () => {
    expect(fresnelOpacity(1)).toBeCloseTo(FRESNEL_OPACITY_MIN);
  });

  it('is at the maximum at a grazing angle (|N·V| = 0)', () => {
    expect(fresnelOpacity(0)).toBeCloseTo(FRESNEL_OPACITY_MAX);
  });
});

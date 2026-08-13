import { describe, expect, it } from 'vitest';
import {
  EXPLODE_OFFSET_PER_LAYER,
  exaggeratedAltitudeKm,
  explodeOffsetUnits,
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

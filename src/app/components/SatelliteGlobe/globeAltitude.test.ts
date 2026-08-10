import { describe, expect, it } from 'vitest';
import { altitudeKmToGlobeRadiusUnits, GLOBE_EARTH_RADIUS_KM } from './globeAltitude.ts';

describe('altitudeKmToGlobeRadiusUnits', () => {
  it('scales km by mean Earth radius', () => {
    expect(altitudeKmToGlobeRadiusUnits(GLOBE_EARTH_RADIUS_KM)).toBe(1);
    expect(altitudeKmToGlobeRadiusUnits(420)).toBeCloseTo(420 / GLOBE_EARTH_RADIUS_KM);
  });

  it('returns zero for non-positive altitude', () => {
    expect(altitudeKmToGlobeRadiusUnits(0)).toBe(0);
    expect(altitudeKmToGlobeRadiusUnits(-100)).toBe(0);
  });
});

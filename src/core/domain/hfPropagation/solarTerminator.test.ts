import { describe, expect, it } from 'vitest';
import { solarZenithAngleDeg } from './solarZenithAngle.ts';
import { computeSolarTerminator } from './solarTerminator.ts';

const EQUINOX_SOLAR_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);
const EQUINOX_MIDNIGHT_UTC = Date.UTC(2024, 2, 20, 0, 0, 0);

describe('computeSolarTerminator', () => {
  it('returns a closed ring of the requested sample count', () => {
    const ring = computeSolarTerminator(EQUINOX_SOLAR_NOON_UTC, 36);
    expect(ring).toHaveLength(37);
    expect(ring[0]).toEqual(ring[36]);
  });

  it('places every sample at ~90° solar zenith for the given instant', () => {
    const ring = computeSolarTerminator(EQUINOX_SOLAR_NOON_UTC, 72);
    for (const [lat, lon] of ring) {
      expect(solarZenithAngleDeg(lat, lon, EQUINOX_SOLAR_NOON_UTC)).toBeCloseTo(90, 0);
    }
  });

  it('still sits on the 90° zenith contour at local midnight', () => {
    const ring = computeSolarTerminator(EQUINOX_MIDNIGHT_UTC, 48);
    for (const [lat, lon] of ring) {
      expect(solarZenithAngleDeg(lat, lon, EQUINOX_MIDNIGHT_UTC)).toBeCloseTo(90, 0);
    }
  });
});

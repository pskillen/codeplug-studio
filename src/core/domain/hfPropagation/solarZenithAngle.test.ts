import { describe, expect, it } from 'vitest';
import { solarZenithAngleDeg } from './solarZenithAngle.ts';

/** 2024-03-20 is a leap-year March equinox; Cooper day-of-year 80 is within ~1° of zero declination. */
const EQUINOX_SOLAR_NOON_UTC = Date.UTC(2024, 2, 20, 12, 0, 0);
const EQUINOX_MIDNIGHT_UTC = Date.UTC(2024, 2, 20, 0, 0, 0);

describe('solarZenithAngleDeg', () => {
  it('is near 0° at solar noon on the equator at an equinox', () => {
    expect(solarZenithAngleDeg(0, 0, EQUINOX_SOLAR_NOON_UTC)).toBeCloseTo(0, 0);
  });

  it('is greater than 90° at local midnight on the equator', () => {
    expect(solarZenithAngleDeg(0, 0, EQUINOX_MIDNIGHT_UTC)).toBeGreaterThan(90);
  });

  it('is greater than 90° at local midnight at mid-latitudes', () => {
    const lonDeg = -0.1;
    const localMidnightAsUtc = Date.UTC(2024, 2, 20, 0, 0, 0) - (lonDeg / 15) * 3_600_000;
    expect(solarZenithAngleDeg(51.5, lonDeg, localMidnightAsUtc)).toBeGreaterThan(90);
  });
});

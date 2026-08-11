import { describe, expect, it } from 'vitest';
import {
  getSatelliteKepsWriteAdapter,
  hasSatelliteKepsWriteAdapter,
  SATELLITE_KEPS_WRITE_ADAPTERS,
} from './satelliteKepsWriteAdapters.ts';

describe('satelliteKepsWriteAdapters', () => {
  it('has an adapter registered for the AT-D890UV profile', () => {
    expect(hasSatelliteKepsWriteAdapter('radio-io-at-d890uv')).toBe(true);
    expect(getSatelliteKepsWriteAdapter('radio-io-at-d890uv')).toBe(
      SATELLITE_KEPS_WRITE_ADAPTERS['radio-io-at-d890uv'],
    );
  });

  it('has no adapter for an unknown or not-yet-shipped (e.g. OpenGD77) profile', () => {
    expect(hasSatelliteKepsWriteAdapter('radio-io-opengd77-dm1701')).toBe(false);
    expect(getSatelliteKepsWriteAdapter('radio-io-opengd77-dm1701')).toBeUndefined();
    expect(hasSatelliteKepsWriteAdapter('not-a-real-profile')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { coordsToLocator, isValidLocator, locatorToCoords } from './maidenhead.ts';

describe('maidenhead', () => {
  it('validates locators', () => {
    expect(isValidLocator('IO85')).toBe(true);
    expect(isValidLocator('io85uk')).toBe(true);
    expect(isValidLocator('JO01GR')).toBe(true);
    expect(isValidLocator('IO8')).toBe(false);
    expect(isValidLocator('ZZ99')).toBe(false);
  });

  it('converts a known UK locator to coordinates', () => {
    // JO01GR ≈ Danbury, Essex.
    const coords = locatorToCoords('JO01GR');
    expect(coords).not.toBeNull();
    if (coords) {
      expect(coords.lat).toBeCloseTo(51.7, 0);
      expect(coords.lon).toBeCloseTo(0.6, 0);
    }
  });

  it('round-trips coordinates at 6 characters', () => {
    const lat = 55.86;
    const lon = -4.25;
    const loc = coordsToLocator(lat, lon, 6);
    const coords = locatorToCoords(loc);
    expect(coords).not.toBeNull();
    if (coords) {
      expect(coords.lat).toBeCloseTo(lat, 0);
      expect(coords.lon).toBeCloseTo(lon, 0);
    }
  });

  it('returns null for invalid input', () => {
    expect(locatorToCoords('nope')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { coordsToLocator, isValidLocator, locatorToCoords } from './maidenhead.ts';

describe('maidenhead', () => {
  it('validates locators at 4/6/8/10 characters', () => {
    expect(isValidLocator('IO85')).toBe(true);
    expect(isValidLocator('io85uk')).toBe(true);
    expect(isValidLocator('JO01GR')).toBe(true);
    expect(isValidLocator('JO01GR12')).toBe(true);
    expect(isValidLocator('JO01GR12AB')).toBe(true);
    expect(isValidLocator('IO8')).toBe(false);
    expect(isValidLocator('ZZ99')).toBe(false);
    expect(isValidLocator('JO01GR1')).toBe(false);
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

  it('round-trips at 4 characters (square centre)', () => {
    const lat = 55.86;
    const lon = -4.25;
    const loc = coordsToLocator(lat, lon, 4);
    expect(loc.length).toBe(4);
    const coords = locatorToCoords(loc);
    expect(coords).not.toBeNull();
    if (coords) {
      expect(coords.lat).toBeCloseTo(lat, 0);
      expect(Math.abs(coords.lon - lon)).toBeLessThanOrEqual(1);
    }
  });

  it.each([6, 8] as const)('round-trips coordinates at %i characters', (precision) => {
    const lat = 55.86;
    const lon = -4.25;
    const loc = coordsToLocator(lat, lon, precision);
    expect(loc.length).toBe(precision);
    const coords = locatorToCoords(loc);
    expect(coords).not.toBeNull();
    if (coords) {
      const decimals = precision <= 6 ? 0 : 1;
      expect(coords.lat).toBeCloseTo(lat, decimals);
      expect(coords.lon).toBeCloseTo(lon, decimals);
    }
  });

  it('round-trips at 10 characters', () => {
    const lat = 55.86;
    const lon = -4.25;
    const loc = coordsToLocator(lat, lon, 10);
    expect(loc.length).toBe(10);
    const coords = locatorToCoords(loc);
    expect(coords).not.toBeNull();
    if (coords) {
      expect(coords.lat).toBeCloseTo(lat, 1);
      expect(coords.lon).toBeCloseTo(lon, 1);
    }
  });

  it('parses IO85uk', () => {
    expect(locatorToCoords('IO85uk')).not.toBeNull();
  });

  it('returns null for invalid input', () => {
    expect(locatorToCoords('nope')).toBeNull();
  });
});

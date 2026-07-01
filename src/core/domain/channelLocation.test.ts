import { describe, expect, it } from 'vitest';
import {
  coordsFromChannelLocation,
  coordinateDecimalPrecision,
  isCoordinateLessPrecise,
  isLocatorLessPrecise,
  locatorCharCount,
  locationConflict,
  normaliseLocator,
  reconcileChannelLocation,
} from './channelLocation.ts';

describe('normaliseLocator', () => {
  it('uppercases valid locator', () => {
    expect(normaliseLocator('io91wm')).toBe('IO91WM');
  });

  it('returns null for invalid locator', () => {
    expect(normaliseLocator('not-a-locator')).toBeNull();
  });
});

describe('reconcileChannelLocation', () => {
  it('derives coords from locator when locator edited last', () => {
    const result = reconcileChannelLocation({
      maidenheadLocator: 'IO91WM',
      location: null,
      useLocation: true,
      lastEdited: 'locator',
    });
    expect(result.maidenheadLocator).toBe('IO91WM');
    expect(result.location).not.toBeNull();
    expect(result.useLocation).toBe(true);
  });

  it('derives locator from coords when coords edited last', () => {
    const result = reconcileChannelLocation({
      maidenheadLocator: 'IO91',
      location: { lat: 51.5074, lon: -0.1278 },
      useLocation: true,
      lastEdited: 'coords',
    });
    expect(result.maidenheadLocator).toMatch(/^IO/);
    expect(result.location?.lat).toBeCloseTo(51.5074, 3);
    expect(result.useLocation).toBe(true);
  });

  it('coordinates win when coords edited after conflicting locator', () => {
    const fromLocator = reconcileChannelLocation({
      maidenheadLocator: 'IO91WM',
      location: null,
      useLocation: true,
      lastEdited: 'locator',
    });
    const result = reconcileChannelLocation({
      maidenheadLocator: fromLocator.maidenheadLocator,
      location: { lat: 57.0, lon: -3.5 },
      useLocation: true,
      lastEdited: 'coords',
    });
    expect(result.location?.lat).toBeCloseTo(57.0, 3);
    expect(result.maidenheadLocator).not.toBe('IO91WM');
  });

  it('clears all when useLocation false and no data', () => {
    expect(
      reconcileChannelLocation({
        maidenheadLocator: null,
        location: null,
        useLocation: false,
        lastEdited: 'coords',
      }),
    ).toEqual({ maidenheadLocator: null, location: null, useLocation: false });
  });
});

describe('coordsFromChannelLocation', () => {
  it('prefers stored coordinates', () => {
    expect(
      coordsFromChannelLocation({
        location: { lat: 1, lon: 2 },
        maidenheadLocator: 'IO91WM',
      }),
    ).toEqual({ lat: 1, lon: 2 });
  });

  it('falls back to locator centre', () => {
    const coords = coordsFromChannelLocation({
      location: null,
      maidenheadLocator: 'IO91WM',
    });
    expect(coords).not.toBeNull();
  });
});

describe('locationConflict', () => {
  it('detects mismatch between coords and locator', () => {
    expect(locationConflict({ lat: 57.0, lon: -3.5 }, 'IO91WM')).toBe(true);
  });
});

describe('location precision helpers', () => {
  it('counts locator characters', () => {
    expect(locatorCharCount('IO91')).toBe(4);
    expect(locatorCharCount('IO91WM')).toBe(6);
    expect(locatorCharCount(null)).toBe(0);
  });

  it('detects less precise locator', () => {
    expect(isLocatorLessPrecise('IO91WM', 'IO91')).toBe(true);
    expect(isLocatorLessPrecise('IO91', 'IO91WM')).toBe(false);
  });

  it('detects less precise coordinates', () => {
    expect(
      isCoordinateLessPrecise({ lat: 51.123456, lon: -1.234567 }, { lat: 51.12, lon: -1.23 }),
    ).toBe(true);
    expect(coordinateDecimalPrecision({ lat: 51.123456, lon: -1.2 })).toBe(1);
  });
});

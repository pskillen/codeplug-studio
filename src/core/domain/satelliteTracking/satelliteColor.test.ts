import { describe, expect, it } from 'vitest';
import { colorForNoradId, hslToRgb, hueForNoradId } from './satelliteColor.ts';

describe('hueForNoradId', () => {
  it('is stable for the same NORAD id', () => {
    expect(hueForNoradId(25544)).toBe(hueForNoradId(25544));
  });

  it('differs for nearby catalogue numbers', () => {
    expect(hueForNoradId(25544)).not.toBe(hueForNoradId(25545));
  });

  it('returns a value in [0, 360)', () => {
    for (const id of [1, 25544, 43017, 99999]) {
      const hue = hueForNoradId(id);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

describe('hslToRgb', () => {
  it('maps primary hues', () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual({ r: 255, g: 0, b: 0 });
    expect(hslToRgb(120, 1, 0.5)).toEqual({ r: 0, g: 255, b: 0 });
    expect(hslToRgb(240, 1, 0.5)).toEqual({ r: 0, g: 0, b: 255 });
  });
});

describe('colorForNoradId', () => {
  it('returns a stable #rrggbb hex by default', () => {
    expect(colorForNoradId(25544)).toMatch(/^#[0-9a-f]{6}$/);
    expect(colorForNoradId(25544)).toBe(colorForNoradId(25544));
  });

  it('returns rgba when alpha is requested', () => {
    expect(colorForNoradId(25544, 0.5)).toMatch(/^rgba\(\d+, \d+, \d+, 0\.5\)$/);
  });
});

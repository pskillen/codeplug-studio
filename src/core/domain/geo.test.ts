import { describe, expect, it } from 'vitest';
import { convexHullLatLon, uniqueLatLon } from './geo.ts';

describe('convexHullLatLon', () => {
  it('returns hull vertices for a square', () => {
    const square: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
      [0.5, 0.5],
    ];
    const hull = convexHullLatLon(square);
    expect(hull).toHaveLength(4);
  });

  it('returns single point unchanged', () => {
    expect(convexHullLatLon([[56.5, -4.0]])).toEqual([[56.5, -4.0]]);
  });
});

describe('uniqueLatLon', () => {
  it('deduplicates points at 5 decimal places', () => {
    const pts: [number, number][] = [
      [56.123451, -4.0],
      [56.123452, -4.0],
      [57.0, -3.5],
    ];
    expect(uniqueLatLon(pts)).toHaveLength(2);
  });
});

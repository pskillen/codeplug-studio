import { describe, expect, it } from 'vitest';
import type { LatLon } from '@core/domain/geo.ts';
import {
  duplicateSegmentsForWorldCopies,
  nearestLongitudeShift,
  splitAtAntimeridian,
  splitRingAtAntimeridian,
  unwrapLongitudes,
} from './mapHelpers.ts';

describe('duplicateSegmentsForWorldCopies', () => {
  const segment: LatLon[] = [
    [10, -10],
    [12, 5],
  ];

  it('duplicates each segment at lng -360, 0, and +360 by default', () => {
    const copies = duplicateSegmentsForWorldCopies([segment]);

    expect(copies).toHaveLength(3);
    expect(copies.map((copy) => copy.worldOffset)).toEqual([-360, 0, 360]);
    expect(copies[0]?.segment[0]).toEqual([10, -370]);
    expect(copies[1]?.segment).toBe(segment);
    expect(copies[2]?.segment[1]).toEqual([12, 365]);
  });

  it('composes with antimeridian splitting', () => {
    const points: LatLon[] = [
      [0, 170],
      [0, -170],
    ];
    const segments = splitAtAntimeridian(points);
    const copies = duplicateSegmentsForWorldCopies(segments);

    expect(segments).toHaveLength(2);
    expect(copies).toHaveLength(6);
  });
});

describe('unwrapLongitudes', () => {
  it('returns points unchanged when there is no antimeridian crossing', () => {
    const points: LatLon[] = [
      [0, 10],
      [1, 15],
      [2, 20],
    ];
    expect(unwrapLongitudes(points)).toEqual(points);
  });

  it('continues eastward past +180 instead of jumping back to -180', () => {
    const points: LatLon[] = [
      [0, 170],
      [0, 179],
      [0, -179],
      [0, -170],
    ];
    expect(unwrapLongitudes(points)).toEqual([
      [0, 170],
      [0, 179],
      [0, 181],
      [0, 190],
    ]);
  });

  it('continues westward past -180 instead of jumping back to +180', () => {
    const points: LatLon[] = [
      [0, -170],
      [0, -179],
      [0, 179],
      [0, 170],
    ];
    expect(unwrapLongitudes(points)).toEqual([
      [0, -170],
      [0, -179],
      [0, -181],
      [0, -190],
    ]);
  });

  it('carries the accumulated shift forward for points sampled after the crossing', () => {
    // One eastward crossing (170 -> 179 -> -179 -> -170, matching the case above, unwrapped to
    // 190), then two more small eastward steps with no further crossing — the +360 correction
    // from the earlier crossing must still apply to them.
    const points: LatLon[] = [
      [0, 170],
      [0, 179],
      [0, -179],
      [0, -170],
      [0, -160],
      [0, -150],
    ];
    const unwrapped = unwrapLongitudes(points);
    expect(unwrapped.map((p) => p[1])).toEqual([170, 179, 181, 190, 200, 210]);
  });

  it('handles empty and single-point input', () => {
    expect(unwrapLongitudes([])).toEqual([]);
    expect(unwrapLongitudes([[5, 175]])).toEqual([[5, 175]]);
  });
});

describe('nearestLongitudeShift', () => {
  it('returns 0 when the point is already closest to the reference', () => {
    expect(nearestLongitudeShift(-5, -2)).toBe(0);
  });

  it('picks +360 when the raw point sits far west of the reference', () => {
    // Raw point at -170, reference at 170: -170 is 340 away directly, but only 20 away as +360.
    expect(nearestLongitudeShift(-170, 170)).toBe(360);
  });

  it('picks -360 when the raw point sits far east of the reference', () => {
    // Raw point at 170, reference at -170: 170 is 340 away directly, but only 20 away as -360.
    expect(nearestLongitudeShift(170, -170)).toBe(-360);
  });

  it('picks a shift beyond a single world-copy when the raw point is many laps away', () => {
    // Raw point unwrapped to 600 (well over a lap and a half east), reference at 10.
    expect(nearestLongitudeShift(600, 10)).toBe(-720);
  });
});

describe('splitRingAtAntimeridian', () => {
  it('returns the ring unsplit when it never crosses the antimeridian', () => {
    const ring: LatLon[] = [
      [0, 10],
      [5, 15],
      [0, 20],
      [-5, 15],
      [0, 10],
    ];
    expect(splitRingAtAntimeridian(ring)).toEqual([ring]);
  });

  it('splits a ring that crosses the antimeridian twice into two closed fragments', () => {
    // A rectangular "ring" straddling the antimeridian: crosses eastbound (170 -> -170) once
    // and westbound (-170 -> 170) once, closing back to its start.
    const ring: LatLon[] = [
      [10, 170],
      [10, -170],
      [-10, -170],
      [-10, 170],
      [10, 170],
    ];

    const fragments = splitRingAtAntimeridian(ring);

    expect(fragments).toHaveLength(2);
    for (const fragment of fragments) {
      // Each fragment is closed against the same antimeridian side at both ends.
      const firstLon = fragment[0]![1];
      const lastLon = fragment[fragment.length - 1]![1];
      expect(Math.abs(firstLon)).toBe(180);
      expect(firstLon).toBe(lastLon);
      // Every latitude stays within the source ring's range.
      for (const [lat] of fragment) {
        expect(lat).toBeGreaterThanOrEqual(-10);
        expect(lat).toBeLessThanOrEqual(10);
      }
    }

    // The two fragments sit on opposite sides of the seam.
    const sides = fragments.map((fragment) => Math.sign(fragment[0]![1]));
    expect(new Set(sides).size).toBe(2);
  });

  it('handles an empty ring', () => {
    expect(splitRingAtAntimeridian([])).toEqual([]);
  });
});

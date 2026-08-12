import { describe, expect, it } from 'vitest';
import type { LatLon } from '@core/domain/geo.ts';
import {
  chooseWorldCopyOffset,
  duplicateSegmentsForWorldCopies,
  splitAtAntimeridian,
  splitRingAtAntimeridian,
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

describe('chooseWorldCopyOffset', () => {
  it('stays at the central (0) repeat when the point is already close to the reference', () => {
    expect(chooseWorldCopyOffset(-5, -2)).toBe(0);
  });

  it('picks the east repeat (+360) when travelling so the raw point sits far west of the reference', () => {
    // Raw point at -170, reference at 170: -170 is 340 away directly, but only 20 away as +360.
    expect(chooseWorldCopyOffset(-170, 170)).toBe(360);
  });

  it('picks the west repeat (-360) when travelling so the raw point sits far east of the reference', () => {
    // Raw point at 170, reference at -170: 170 is 340 away directly, but only 20 away as -360.
    expect(chooseWorldCopyOffset(170, -170)).toBe(-360);
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

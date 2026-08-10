import { describe, expect, it } from 'vitest';
import type { LatLon } from '@core/domain/geo.ts';
import { duplicateSegmentsForWorldCopies, splitAtAntimeridian } from './mapHelpers.ts';

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

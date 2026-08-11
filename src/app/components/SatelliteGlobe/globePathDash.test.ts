import { describe, expect, it } from 'vitest';
import {
  estimateGlobePathArcLength,
  globePathDashGap,
  globePathDashLength,
} from './globePathDash.ts';
import type { GlobePath } from './buildGlobeData.ts';

function makePastPath(points: [number, number, number][]): GlobePath {
  return {
    kind: 'trail-past',
    satelliteId: 'iss',
    points,
    color: '#c45a2a',
  };
}

describe('globePathDash', () => {
  it('scales dash ratios inversely with path length so dash count stays roughly stable', () => {
    const shortPath = makePastPath([
      [0, 0, 0.1],
      [0, 10, 0.1],
      [0, 20, 0.1],
    ]);
    const longPath = makePastPath([
      [0, 0, 0.1],
      [0, 30, 0.1],
      [0, 60, 0.1],
      [0, 90, 0.1],
      [0, 120, 0.1],
    ]);

    const shortLen = estimateGlobePathArcLength(shortPath.points);
    const longLen = estimateGlobePathArcLength(longPath.points);
    expect(longLen).toBeGreaterThan(shortLen);

    const shortDash = globePathDashLength(shortPath);
    const longDash = globePathDashLength(longPath);
    expect(longDash).toBeLessThan(shortDash);
    expect(shortDash / longDash).toBeCloseTo(longLen / shortLen, 1);
  });

  it('returns solid future paths', () => {
    const future: GlobePath = {
      kind: 'trail-future',
      satelliteId: 'iss',
      points: [
        [0, 0, 0.1],
        [0, 10, 0.1],
      ],
      color: '#c45a2a',
    };
    expect(globePathDashLength(future)).toBe(1);
    expect(globePathDashGap(future)).toBe(0);
  });
});

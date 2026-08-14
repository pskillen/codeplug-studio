import { describe, expect, it } from 'vitest';
import { MODE_COLORS, SKIP_ZONE_PATH_COLOR, TERMINATOR_PATH_COLOR } from './buildGlobeData.ts';
import { propagationPathDashGap, propagationPathDashLength } from './globePathDash.ts';
import type { HfGlobePath } from './buildGlobeData.ts';

function rayPath(mode: 'groundwave' | 'skywave' | 'nvis' | 'absorbed' | 'escaped'): HfGlobePath {
  return {
    kind: 'ray',
    mode,
    color: MODE_COLORS[mode],
    points: [
      [0, 0, 0],
      [10, 20, 0.02],
      [20, 40, 0],
    ],
  };
}

describe('propagationPathDashLength / Gap', () => {
  it('keeps groundwave solid', () => {
    const path = rayPath('groundwave');
    expect(propagationPathDashLength(path)).toBe(1);
    expect(propagationPathDashGap(path)).toBe(0);
  });

  it('dashes skywave, NVIS, absorbed, and escaped with distinct gap/length pairs', () => {
    const sky = rayPath('skywave');
    const nvis = rayPath('nvis');
    const absorbed = rayPath('absorbed');
    const escaped = rayPath('escaped');
    expect(propagationPathDashGap(sky)).toBeGreaterThan(0);
    expect(propagationPathDashGap(nvis)).toBeGreaterThan(0);
    expect(propagationPathDashGap(absorbed)).toBeGreaterThan(propagationPathDashGap(sky));
    expect(propagationPathDashLength(escaped)).toBeLessThan(propagationPathDashLength(sky));
  });

  it('keeps the terminator greyline dash fractions', () => {
    const path: HfGlobePath = {
      kind: 'terminator',
      color: TERMINATOR_PATH_COLOR,
      points: [
        [0, -10, 0.014],
        [10, 0, 0.014],
      ],
    };
    expect(propagationPathDashLength(path)).toBe(0.18);
    expect(propagationPathDashGap(path)).toBe(0.05);
  });

  it('dashes the skip-zone ring', () => {
    const path: HfGlobePath = {
      kind: 'skip-zone',
      color: SKIP_ZONE_PATH_COLOR,
      points: [
        [0, 0, 0.008],
        [2, 2, 0.008],
        [0, 4, 0.008],
      ],
    };
    expect(propagationPathDashLength(path)).toBeGreaterThan(0);
    expect(propagationPathDashLength(path)).toBeLessThan(1);
    expect(propagationPathDashGap(path)).toBeGreaterThan(0);
  });
});

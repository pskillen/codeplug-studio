import { describe, expect, it } from 'vitest';

import {
  DEVELOPER_MODE_TAP_GAP_MS,
  INITIAL_VERSION_TAP_STATE,
  registerVersionTap,
  versionTapMessage,
  type VersionTapResult,
} from './developerModeTaps.ts';

function tapAt(times: number[]): VersionTapResult[] {
  let state = INITIAL_VERSION_TAP_STATE;
  return times.map((t) => {
    const next = registerVersionTap(state, t);
    state = next.state;
    return next.result;
  });
}

describe('registerVersionTap', () => {
  it('toggles on the fifth tap in a row, counting down from the second', () => {
    expect(tapAt([0, 100, 200, 300, 400])).toEqual([
      { kind: 'none' },
      { kind: 'countdown', remaining: 3 },
      { kind: 'countdown', remaining: 2 },
      { kind: 'countdown', remaining: 1 },
      { kind: 'toggle' },
    ]);
  });

  it('starts again after a pause longer than the gap', () => {
    const results = tapAt([0, 100, 200, 200 + DEVELOPER_MODE_TAP_GAP_MS + 1, 3000]);
    expect(results.map((r) => r.kind)).toEqual([
      'none',
      'countdown',
      'countdown',
      'none',
      'countdown',
    ]);
  });

  it('starts again after a toggle', () => {
    const results = tapAt([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(results.filter((r) => r.kind === 'toggle')).toHaveLength(2);
  });
});

describe('versionTapMessage', () => {
  it('says how many taps remain and which way', () => {
    expect(versionTapMessage({ kind: 'none' }, false)).toBeNull();
    expect(versionTapMessage({ kind: 'countdown', remaining: 3 }, false)).toBe(
      '3 more taps to turn on developer mode',
    );
    expect(versionTapMessage({ kind: 'countdown', remaining: 1 }, true)).toBe(
      '1 more tap to turn off developer mode',
    );
    expect(versionTapMessage({ kind: 'toggle' }, false)).toBe('Developer mode is on');
    expect(versionTapMessage({ kind: 'toggle' }, true)).toBe('Developer mode is off');
  });
});

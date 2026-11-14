import { describe, expect, it } from 'vitest';

import {
  DEVELOPER_MODE_ALREADY_ON_MESSAGE,
  DEVELOPER_MODE_TAP_GAP_MS,
  developerModeTurnOnMessage,
  INITIAL_VERSION_TAP_STATE,
  registerVersionTap,
  versionTapMessage,
  type VersionTapResult,
} from './developerModeTaps.ts';

/** Taps at the given times. `onFromStart` is developer mode before the first; a `turnOn` switches it on. */
function tapAt(times: number[], onFromStart = false): VersionTapResult[] {
  let state = INITIAL_VERSION_TAP_STATE;
  let on = onFromStart;
  return times.map((t) => {
    const next = registerVersionTap(state, t, on);
    state = next.state;
    if (next.result.kind === 'turnOn') on = true;
    return next.result;
  });
}

describe('registerVersionTap', () => {
  it('turns on at the fifth tap in a row, counting down from the second', () => {
    expect(tapAt([0, 100, 200, 300, 400])).toEqual([
      { kind: 'none' },
      { kind: 'countdown', remaining: 3 },
      { kind: 'countdown', remaining: 2 },
      { kind: 'countdown', remaining: 1 },
      { kind: 'turnOn' },
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

  it('never turns developer mode off: while on, taps only say it is on', () => {
    expect(tapAt([0, 100, 200, 300, 400, 500, 600], true).map((r) => r.kind)).toEqual([
      'none',
      'alreadyOn',
      'alreadyOn',
      'alreadyOn',
      'alreadyOn',
      'alreadyOn',
      'alreadyOn',
    ]);
  });

  it('keeps tapping after turning on without counting toward off', () => {
    const results = tapAt([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(results.filter((r) => r.kind === 'turnOn')).toHaveLength(1);
    expect(results[5]).toEqual({ kind: 'none' });
    expect(results.slice(6).every((r) => r.kind === 'alreadyOn')).toBe(true);
  });

  it('shows nothing for a single stray tap while on', () => {
    expect(tapAt([0, 0 + DEVELOPER_MODE_TAP_GAP_MS + 1], true)).toEqual([
      { kind: 'none' },
      { kind: 'none' },
    ]);
  });
});

describe('versionTapMessage', () => {
  it('counts down toward on only, and points at the top bar while on', () => {
    expect(versionTapMessage({ kind: 'none' })).toBeNull();
    expect(versionTapMessage({ kind: 'countdown', remaining: 3 })).toBe(
      '3 more taps to turn on developer mode',
    );
    expect(versionTapMessage({ kind: 'countdown', remaining: 1 })).toBe(
      '1 more tap to turn on developer mode',
    );
    expect(versionTapMessage({ kind: 'turnOn' })).toBe('Developer mode is on');
    expect(versionTapMessage({ kind: 'alreadyOn' })).toBe(DEVELOPER_MODE_ALREADY_ON_MESSAGE);
    expect(DEVELOPER_MODE_ALREADY_ON_MESSAGE).toMatch(/top bar/);
  });
});

describe('developerModeTurnOnMessage', () => {
  it('reports the stored state after the fifth tap, or that it could not change', () => {
    expect(developerModeTurnOnMessage(true)).toBe('Developer mode is on');
    expect(developerModeTurnOnMessage(false)).toBe(
      'Developer mode could not be turned on: this browser blocks storage',
    );
  });
});

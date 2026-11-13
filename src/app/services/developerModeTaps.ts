/**
 * The "tap the version five times" gesture for developer mode (#1650), as on Android. Pure: the caller keeps the
 * state and passes the time.
 */

export const DEVELOPER_MODE_TAPS = 5;
/** Taps further apart than this start the count again. */
export const DEVELOPER_MODE_TAP_GAP_MS = 2000;
/** The countdown toast starts at this tap, so a single stray tap shows nothing. */
const FIRST_TOAST_AT = 2;

export interface VersionTapState {
  count: number;
  lastAt: number | null;
}

export const INITIAL_VERSION_TAP_STATE: VersionTapState = { count: 0, lastAt: null };

export type VersionTapResult =
  { kind: 'none' } | { kind: 'countdown'; remaining: number } | { kind: 'toggle' };

export function registerVersionTap(
  state: VersionTapState,
  now: number,
): { state: VersionTapState; result: VersionTapResult } {
  const continuing = state.lastAt !== null && now - state.lastAt <= DEVELOPER_MODE_TAP_GAP_MS;
  const count = (continuing ? state.count : 0) + 1;
  if (count >= DEVELOPER_MODE_TAPS) {
    return { state: INITIAL_VERSION_TAP_STATE, result: { kind: 'toggle' } };
  }
  const result: VersionTapResult =
    count >= FIRST_TOAST_AT
      ? { kind: 'countdown', remaining: DEVELOPER_MODE_TAPS - count }
      : { kind: 'none' };
  return { state: { count, lastAt: now }, result };
}

/** Toast text for a tap, or null for none. `onBefore` is developer mode before this tap. */
export function versionTapMessage(result: VersionTapResult, onBefore: boolean): string | null {
  if (result.kind === 'none') return null;
  if (result.kind === 'toggle') return onBefore ? 'Developer mode is off' : 'Developer mode is on';
  const taps = result.remaining === 1 ? '1 more tap' : `${result.remaining} more taps`;
  return `${taps} to turn ${onBefore ? 'off' : 'on'} developer mode`;
}

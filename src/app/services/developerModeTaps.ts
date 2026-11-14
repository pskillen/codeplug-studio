/**
 * The "tap the version five times" gesture for developer mode (#1650), as on Android. Pure: the caller keeps the
 * state and passes the time. The gesture only turns developer mode on (#1686); the top bar's Developer mode chip and
 * the Debug page switch turn it off.
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
  | { kind: 'none' }
  | { kind: 'countdown'; remaining: number }
  | { kind: 'turnOn' }
  | { kind: 'alreadyOn' };

/**
 * One tap on the version. `developerModeOn` is developer mode before this tap: while it is on, taps never count down
 * or change anything, and from the second tap in a row they only say it is already on.
 */
export function registerVersionTap(
  state: VersionTapState,
  now: number,
  developerModeOn: boolean,
): { state: VersionTapState; result: VersionTapResult } {
  const continuing = state.lastAt !== null && now - state.lastAt <= DEVELOPER_MODE_TAP_GAP_MS;
  const count = (continuing ? state.count : 0) + 1;
  if (developerModeOn) {
    const result: VersionTapResult =
      count >= FIRST_TOAST_AT ? { kind: 'alreadyOn' } : { kind: 'none' };
    return { state: { count, lastAt: now }, result };
  }
  if (count >= DEVELOPER_MODE_TAPS) {
    return { state: INITIAL_VERSION_TAP_STATE, result: { kind: 'turnOn' } };
  }
  const result: VersionTapResult =
    count >= FIRST_TOAST_AT
      ? { kind: 'countdown', remaining: DEVELOPER_MODE_TAPS - count }
      : { kind: 'none' };
  return { state: { count, lastAt: now }, result };
}

/** The note for taps while developer mode is already on: it points at the top bar's off switch. */
export const DEVELOPER_MODE_ALREADY_ON_MESSAGE =
  'Developer mode is on. Turn it off from the top bar';

/** Toast text for a tap, or null for none. */
export function versionTapMessage(result: VersionTapResult): string | null {
  if (result.kind === 'none') return null;
  if (result.kind === 'turnOn') return 'Developer mode is on';
  if (result.kind === 'alreadyOn') return DEVELOPER_MODE_ALREADY_ON_MESSAGE;
  const taps = result.remaining === 1 ? '1 more tap' : `${result.remaining} more taps`;
  return `${taps} to turn on developer mode`;
}

/**
 * Toast text after the fifth tap, from developer mode as stored after it. When storage refused the change (private
 * mode, blocked storage) it is still off, and the toast says so rather than claiming it is on.
 */
export function developerModeTurnOnMessage(onAfter: boolean): string {
  return onAfter
    ? 'Developer mode is on'
    : 'Developer mode could not be turned on: this browser blocks storage';
}

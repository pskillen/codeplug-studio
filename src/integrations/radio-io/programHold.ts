/**
 * How long a held programming-mode session is trusted (#1393). The Write stepper keeps the
 * session open on its Review step; a radio that may have left programming mode meanwhile gets a
 * reconnect and re-read before anything is transmitted.
 */

import type { RadioDescriptor } from './types.ts';

/** Hold time assumed for radios that do not declare `programHoldSafeMs`. */
export const DEFAULT_PROGRAM_HOLD_SAFE_MS = 30_000;

export function programHoldSafeMs(descriptor: Pick<RadioDescriptor, 'programHoldSafeMs'>): number {
  return descriptor.programHoldSafeMs ?? DEFAULT_PROGRAM_HOLD_SAFE_MS;
}

/** True when Review has been open longer than the radio is trusted to stay in programming mode. */
export function reviewNeedsReconnect(
  descriptor: Pick<RadioDescriptor, 'programHoldSafeMs'>,
  elapsedMs: number,
): boolean {
  return elapsedMs > programHoldSafeMs(descriptor);
}

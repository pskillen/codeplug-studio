/**
 * Warning for a Write that was interrupted after it had already sent whole erase units (#1406).
 *
 * Leaving PROGRAM without `END` keeps the unit in progress safe, but the units the session had
 * finished are committed by the next write-mode `END` from any tool. Studio records them per
 * radio and refuses other writes to that radio until a Write rewrites them; this is the text
 * shown next to the failure, so the operator knows before they reach for the CPS, plus the way
 * out for an operator who repaired the radio some other way.
 */

import { isAtD890RadioIoProfileId } from '@core/import-export/formatProfiles.ts';
import {
  AtD890PendingUnitsError,
  clearAtD890PendingRadios,
  describeAtD890PendingUnits,
  findLatestAtD890PendingBlock,
  type AtD890PendingBlock,
} from '@integrations/radio-io/radios/at-d890uv/pendingUnits.ts';

/** What the stepper shows and offers next to a failed or refused D890 Write. */
export interface InterruptedWriteNotice {
  /** Text to append to the failure message; `null` when the refusal's own message carries it. */
  text: string | null;
  /** The record behind the notice, for the "I have rewritten this radio" action. */
  block: AtD890PendingBlock;
}

export function interruptedWriteNotice(
  profileId: string,
  err: unknown,
): InterruptedWriteNotice | null {
  if (!isAtD890RadioIoProfileId(profileId)) return null;
  // The refusal's own message already carries the text.
  if (err instanceof AtD890PendingUnitsError) return { text: null, block: err.block };
  const block = findLatestAtD890PendingBlock();
  return block ? { text: describeAtD890PendingUnits(block), block } : null;
}

/** The warning to append to a failed Write's message, or `null` when the radio is unaffected. */
export function interruptedWriteWarning(profileId: string, err: unknown): string | null {
  return interruptedWriteNotice(profileId, err)?.text ?? null;
}

/** The operator confirmed the radio has been rewritten: lift the warning and the block. */
export function clearInterruptedWriteWarning(block: AtD890PendingBlock): void {
  clearAtD890PendingRadios(block.radios);
}

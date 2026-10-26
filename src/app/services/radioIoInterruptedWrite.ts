/**
 * Warning for a Write that was interrupted after it had already sent whole erase units (#1406).
 *
 * Leaving PROGRAM without `END` keeps the unit in progress safe, but the units the session had
 * finished are committed by the next write-mode `END` from any tool. Studio records them and
 * refuses other D890 writes until a Write rewrites them; this is the text shown next to the
 * failure, so the operator knows before they reach for the CPS.
 */

import { isAtD890RadioIoProfileId } from '@core/import-export/formatProfiles.ts';
import {
  AtD890PendingUnitsError,
  describeAtD890PendingUnits,
  readAtD890PendingUnits,
} from '@integrations/radio-io/radios/at-d890uv/pendingUnits.ts';

/** The warning to append to a failed Write's message, or `null` when the radio is unaffected. */
export function interruptedWriteWarning(profileId: string, err: unknown): string | null {
  if (!isAtD890RadioIoProfileId(profileId)) return null;
  // The refusal's own message already carries it.
  if (err instanceof AtD890PendingUnitsError) return null;
  const units = readAtD890PendingUnits();
  return units.length > 0 ? describeAtD890PendingUnits(units) : null;
}

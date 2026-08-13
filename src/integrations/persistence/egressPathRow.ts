import { isRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import type { EgressPath } from '@core/models/egressPath.ts';

/**
 * Normalise egress rows read from storage or about to be written.
 *
 * Radio-clone hydration bags must not survive project load/save ([#874] / #879) — they become
 * in-session only until each radio's drop-stash phase. NeonPlug donor retain and other hydration
 * shapes are untouched.
 */
export function readEgressPathRow(row: EgressPath): EgressPath {
  if (!isRadioCloneHydrationBag(row.hydration)) {
    return row;
  }
  const next: EgressPath = { ...row };
  delete next.hydration;
  return next;
}

import type { WireNameRemediation } from '@core/services/resolveWireNames.ts';

/**
 * Maps satellite keps' `nameTruncated` boolean onto the shared severity marker table
 * (wire-preview rework phase 6, ux-proposal.md §2) — satellite write preview doesn't run
 * through `resolveWireNames` (fixed-width radio name field, own shortener), so there is no
 * resolver `remediation` to read directly. `nameTruncated` conflates two different outcomes
 * (`resolveTransmitterWireNames` clean dictionary-shortening vs `encodeName`'s hard byte-budget
 * slice) — approximate the split from the encoded name's length against the write budget: a
 * result that lands under budget was shortened cleanly; one that fills the whole budget was
 * cut. Do not leave the orange triangle on every shorten (that's the anti-pattern this phase
 * fixes) — only a hard cut gets it.
 */
export function satelliteNameRemediation(
  nameTruncated: boolean,
  encodedName: string,
  nameLimit: number,
): WireNameRemediation {
  if (!nameTruncated) return 'none';
  return encodedName.length >= nameLimit ? 'truncated' : 'shortened';
}

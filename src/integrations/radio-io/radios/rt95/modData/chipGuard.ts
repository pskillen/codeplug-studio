import { RT95_IDENT_PREFIX } from './layout.ts';

export type Rt95ChipGuardResult =
  { ok: true } | { ok: false; reason: 'read-failed' | 'empty-block' | 'aliased' | 'bad-ident' };

/**
 * Chip-size guard: a 16 KiB part ignores address bits 14-15, so 0x7B00 reads back the ident at 0x3B00.
 * `undefined` or a length other than 16 means the read failed. An all-zero block (either read) is refused as
 * `empty-block`: when the main board never answers, the head itself returns a zero block with a valid checksum, so a
 * zero 0x7B00 would otherwise "differ" from the ident and pass (fail open). Retry rather than trust it.
 * Check order: read-failed, empty-block, bad-ident, aliased.
 * Only reads decide; nothing is ever written at 0x7B00.
 */
export function evaluateRt95ChipGuard(
  ident: Uint8Array | undefined,
  alias: Uint8Array | undefined,
): Rt95ChipGuardResult {
  if (!ident || !alias || ident.length !== 16 || alias.length !== 16) {
    return { ok: false, reason: 'read-failed' };
  }
  if (isAllZero(ident) || isAllZero(alias)) return { ok: false, reason: 'empty-block' };
  for (let i = 0; i < RT95_IDENT_PREFIX.length; i++) {
    if (ident[i] !== RT95_IDENT_PREFIX[i]) return { ok: false, reason: 'bad-ident' };
  }
  let equal = true;
  for (let i = 0; i < 16; i++) {
    if (ident[i] !== alias[i]) {
      equal = false;
      break;
    }
  }
  if (equal) return { ok: false, reason: 'aliased' };
  return { ok: true };
}

function isAllZero(block: Uint8Array): boolean {
  return block.every((b) => b === 0);
}

/** Operator-facing text for a failed chip guard. */
export function rt95ChipGuardRefusalText(
  reason: Exclude<Rt95ChipGuardResult, { ok: true }>['reason'],
): string {
  if (reason === 'empty-block') {
    return 'The radio returned an empty block while its memory was being checked. Nothing was written. Try the Write again.';
  }
  return "This radio's memory is too small for MM9PDY zones and descriptions (or could not be checked). Use the stock RT95 target.";
}

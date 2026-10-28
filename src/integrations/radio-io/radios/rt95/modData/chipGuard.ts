import { RT95_IDENT_PREFIX } from './layout.ts';

export type Rt95ChipGuardResult =
  { ok: true } | { ok: false; reason: 'read-failed' | 'aliased' | 'bad-ident' };

/**
 * Chip-size guard: a 16 KiB part ignores address bits 14-15, so 0x7B00 reads back the ident at 0x3B00.
 * `undefined` or a length other than 16 means the read failed. Check order: read-failed, bad-ident, aliased.
 * Only reads decide; nothing is ever written at 0x7B00.
 */
export function evaluateRt95ChipGuard(
  ident: Uint8Array | undefined,
  alias: Uint8Array | undefined,
): Rt95ChipGuardResult {
  if (!ident || !alias || ident.length !== 16 || alias.length !== 16) {
    return { ok: false, reason: 'read-failed' };
  }
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

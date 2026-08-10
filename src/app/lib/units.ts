/** Frequency conversion + parsing helpers for form inputs (display in MHz, store Hz). */

/**
 * Generic RF sanity ceiling for `mhzStringToHz`/`parseOptionalFloat` — a broad EM-spectrum bound
 * (300 GHz), not a radio- or format-specific limit. Rejects clearly-bogus entry (negative, zero,
 * or absurdly large), not a hardware capability ladder — those live in `src/core/radios/`.
 */
const MAX_SANE_MHZ = 300_000;
const MAX_SANE_FLOAT = 300_000;

export function hzToMhzString(hz: number | null): string {
  if (hz === null) return '';
  return (hz / 1_000_000).toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
}

/** Parses a MHz frequency from a form field; blank, non-numeric, or out of `(0, 300 GHz]` → null. */
export function mhzStringToHz(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const mhz = Number(trimmed);
  if (!Number.isFinite(mhz) || mhz <= 0 || mhz > MAX_SANE_MHZ) return null;
  return Math.round(mhz * 1_000_000);
}

export function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/**
 * Parses a decimal number (e.g. a CTCSS tone in Hz) from a form field; blank, non-numeric, or
 * out of `(0, 300000]` → null.
 */
export function parseOptionalFloat(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || n > MAX_SANE_FLOAT) return null;
  return n;
}

/** Formats an optional Hz value as a plain decimal string for a form field (e.g. a tone). */
export function optionalNumberToString(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

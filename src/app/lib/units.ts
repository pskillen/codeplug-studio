/** Frequency conversion + parsing helpers for form inputs (display in MHz, store Hz). */

export function hzToMhzString(hz: number | null): string {
  if (hz === null) return '';
  return (hz / 1_000_000).toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
}

export function mhzStringToHz(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const mhz = Number(trimmed);
  if (!Number.isFinite(mhz)) return null;
  return Math.round(mhz * 1_000_000);
}

export function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Parses a decimal number (e.g. a CTCSS tone in Hz) from a form field; blank/invalid → null. */
export function parseOptionalFloat(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Formats an optional Hz value as a plain decimal string for a form field (e.g. a tone). */
export function optionalNumberToString(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

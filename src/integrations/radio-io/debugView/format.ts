import type { NumberFormat } from './types.ts';

/** `0x1A`, padded to `width` bytes (default 1), upper case. */
export function formatHex(value: number, width: 1 | 2 | 3 | 4 = 1): string {
  return `0x${value
    .toString(16)
    .toUpperCase()
    .padStart(width * 2, '0')}`;
}

/** `0x1A (26)`: for raw bytes, enums and codes. */
export function formatHexDec(value: number, width: 1 | 2 | 3 | 4 = 1): string {
  return `${formatHex(value, width)} (${value})`;
}

/** Decimal with an optional unit: `26 MHz`. For counts, frequencies and physical values. */
export function formatDecimal(value: number, unit?: string): string {
  return unit ? `${value} ${unit}` : String(value);
}

/** Placeholder for a value that was not captured. */
export const NOT_CAPTURED = '—';

/** Prints `value` in the chosen format; `undefined` prints the not-captured dash. */
export function formatNumber(
  value: number | undefined,
  format: NumberFormat,
  width: 1 | 2 | 3 | 4 = 1,
  unit?: string,
): string {
  if (value === undefined) return NOT_CAPTURED;
  switch (format) {
    case 'hex':
      return formatHex(value, width);
    case 'decimal':
      return formatDecimal(value, unit);
    default:
      return formatHexDec(value, width);
  }
}

/**
 * Anytone AT-D890UV standard CTCSS tone indices (facts from anytone-cps `CTCSS_CODE`).
 * Index 51 ("Custom CTCSS") is not modelled — surfaces as none on decode.
 */

/** Hz values for combo-box indices 0–50 (index 0 = 62.5 Hz). */
export const AT_D890_CTCSS_TONE_HZ: readonly number[] = [
  62.5, 67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4,
  100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0, 127.3, 131.8, 136.5, 141.3,
  146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9, 171.3, 173.8, 177.3, 179.9,
  183.5, 186.2, 189.9, 192.8, 196.6, 199.5, 203.5, 206.5, 210.7, 218.1, 225.7,
  229.1, 233.6, 241.8, 250.3, 254.1,
] as const;

const HZ_TOLERANCE = 0.05;

export function ctcssIndexFromHz(hz: number): number {
  if (!Number.isFinite(hz) || hz <= 0) return 0;
  for (let i = 0; i < AT_D890_CTCSS_TONE_HZ.length; i++) {
    if (Math.abs(AT_D890_CTCSS_TONE_HZ[i]! - hz) <= HZ_TOLERANCE) {
      return i;
    }
  }
  return 0;
}

export function ctcssHzFromIndex(index: number): number | null {
  if (index <= 0 || index >= AT_D890_CTCSS_TONE_HZ.length) return null;
  return AT_D890_CTCSS_TONE_HZ[index] ?? null;
}

/**
 * RadioFoundry power byte: qdmr's 10-step scale (1 = min ... 10 = max; 0 = radio default).
 *
 * A board with nine or more levels reads byte n as level n - 1. A board with fewer spreads the
 * ten steps over its levels. Rule from RadioFoundry core/codeplug/codeplug.c lines 664-687
 * (power_from_byte / power_to_byte, MIT, at 454a5b76); this is Studio's own implementation.
 * Levels here are 0-based and lowest first.
 */

/** True when the byte is the plain "level + 1" scale rather than the spread one. */
function isDirectScale(count: number): boolean {
  return count >= 9 || count < 2;
}

/** The byte written for a 0-based level on a board with `count` levels. */
export function radioFoundryLevelToByte(level: number, count: number): number {
  const clamped = Math.max(0, Math.min(count - 1, Math.trunc(level)));
  if (isDirectScale(count)) return clamped + 1;
  return Math.floor((clamped * 9 + Math.floor((count - 1) / 2)) / (count - 1)) + 1;
}

/** The 0-based level a byte selects, or null for byte 0 (the radio default). */
export function radioFoundryByteToLevel(byte: number, count: number): number | null {
  if (!Number.isFinite(byte) || byte <= 0) return null;
  if (isDirectScale(count)) return Math.min(count - 1, byte - 1);
  const step = Math.min(byte - 1, 9);
  return Math.floor((step * (count - 1) + 4) / 9);
}

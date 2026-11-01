/**
 * Smallest width a grid track can shrink to, as a CSS length — used to give the header and body a
 * shared `min-width` so rows are as wide as their tracks (sticky cells need that to stay pinned).
 * Intrinsic keywords (`max-content`, `auto`, …) fall back to the default column floor.
 */
export function trackMinWidth(track: string): string {
  const t = track.trim();
  const min = /^minmax\(\s*([^,]+?)\s*,/.exec(t)?.[1] ?? t;
  if (/^\d*\.?\d+fr$/.test(min)) return '0px';
  if (/^-?\d*\.?\d+(px|rem|em|ch|vw|%)?$/.test(min) || /^(calc|clamp|min|max)\(/.test(min)) {
    return min;
  }
  return '8rem';
}

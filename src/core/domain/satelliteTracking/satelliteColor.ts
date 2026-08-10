/**
 * Deterministic display colour for a satellite, keyed by NORAD catalogue ID so the same
 * bird stays the same hue across the pass grid, 2D ground track, and 3D globe.
 *
 * Emits classic CSS colour forms (`#rrggbb` / `rgba(...)`) that Leaflet, browsers, and
 * `three-globe` / Three.js `Color` all parse — modern space-separated `hsl()` is rejected
 * by Three.js and crashes path colouring.
 */

/** Golden-angle step — spreads consecutive catalogue numbers around the hue wheel. */
const GOLDEN_ANGLE_DEG = 137.508;

const SATURATION = 0.72;
const LIGHTNESS = 0.48;

/** Hue in [0, 360) derived from `noradId`. */
export function hueForNoradId(noradId: number): number {
  const n = Math.abs(Math.trunc(noradId));
  return (n * GOLDEN_ANGLE_DEG) % 360;
}

/** Convert HSL (h degrees, s/l in 0–1) to 0–255 RGB channels. */
export function hslToRgb(
  hDeg: number,
  saturation: number,
  lightness: number,
): { r: number; g: number; b: number } {
  const h = ((hDeg % 360) + 360) % 360;
  const s = Math.min(1, Math.max(0, saturation));
  const l = Math.min(1, Math.max(0, lightness));

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h < 60) {
    r1 = c;
    g1 = x;
  } else if (h < 120) {
    r1 = x;
    g1 = c;
  } else if (h < 180) {
    g1 = c;
    b1 = x;
  } else if (h < 240) {
    g1 = x;
    b1 = c;
  } else if (h < 300) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, '0');
}

/**
 * CSS colour for a NORAD id — `#rrggbb` when opaque, `rgba(r, g, b, a)` when translucent.
 */
export function colorForNoradId(noradId: number, alpha = 1): string {
  const { r, g, b } = hslToRgb(hueForNoradId(noradId), SATURATION, LIGHTNESS);
  const clamped = Math.min(1, Math.max(0, alpha));
  if (clamped >= 1) {
    return `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  }
  return `rgba(${r}, ${g}, ${b}, ${clamped})`;
}

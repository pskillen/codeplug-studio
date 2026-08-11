import type { GlobePath } from './buildGlobeData.ts';

/** Target dash/gap size along the path in radians of great-circle arc (~2° at the surface). */
const DASH_ARC_RAD = (2 * Math.PI) / 180;
const GAP_ARC_RAD = (2 * Math.PI) / 180;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between consecutive `[lat, lng, alt]` samples (alt ignored). */
export function estimateGlobePathArcLength(points: [number, number, number][]): number {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const [lat1, lng1] = points[i - 1]!;
    const [lat2, lng2] = points[i]!;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    total += 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

/** Dash length as a fraction of total path length — scales inversely so dashes stay fixed size. */
export function globePathDashLength(path: GlobePath): number {
  if (path.kind !== 'trail-past') return 1;
  const arcLength = estimateGlobePathArcLength(path.points);
  if (arcLength <= 0) return 1;
  return Math.min(1, DASH_ARC_RAD / arcLength);
}

export function globePathDashGap(path: GlobePath): number {
  if (path.kind !== 'trail-past') return 0;
  const arcLength = estimateGlobePathArcLength(path.points);
  if (arcLength <= 0) return 0;
  return Math.min(1, GAP_ARC_RAD / arcLength);
}

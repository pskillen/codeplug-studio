export type LatLon = [number, number];

export interface ZoneColor {
  fill: string;
  stroke: string;
}

/** Convex hull on [lat, lon]; returns points in hull order. */
export function convexHullLatLon(points: LatLon[]): LatLon[] {
  if (points.length <= 1) return points;

  const pts = [...points].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const cross = (o: LatLon, a: LatLon, b: LatLon) =>
    (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);

  const lower: LatLon[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: LatLon[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

export function uniqueLatLon(points: LatLon[]): LatLon[] {
  const seen = new Set<string>();
  const out: LatLon[] = [];
  for (const p of points) {
    const key = `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function zoneColor(index: number): ZoneColor {
  const hue = (index * 137.508) % 360;
  return {
    fill: `hsla(${hue}, 65%, 52%, 0.22)`,
    stroke: `hsla(${hue}, 70%, 38%, 0.9)`,
  };
}

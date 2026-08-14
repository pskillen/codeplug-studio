import { haversineDistanceM } from '@core/domain/geoDistance.ts';

export const CHART_WIDTH = 800;
export const CHART_HEIGHT = 400;
/** Covers F2's upper bound with headroom. */
export const MAX_ALTITUDE_KM = 500;

export function xForDistanceM(distanceM: number, maxRangeM: number): number {
  if (!(maxRangeM > 0)) return 0;
  return (Math.min(Math.max(distanceM, 0), maxRangeM) / maxRangeM) * CHART_WIDTH;
}

export function yForAltitudeKm(altitudeKm: number): number {
  const clamped = Math.min(Math.max(altitudeKm, 0), MAX_ALTITUDE_KM);
  return CHART_HEIGHT - (clamped / MAX_ALTITUDE_KM) * CHART_HEIGHT;
}

/** Cumulative distance from the first point, for each point in a ray's path. */
export function cumulativeDistancesM(points: { lat: number; lon: number }[]): number[] {
  if (points.length === 0) return [];
  const distances: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    distances.push(distances[i - 1] + haversineDistanceM(prev.lat, prev.lon, cur.lat, cur.lon));
  }
  return distances;
}

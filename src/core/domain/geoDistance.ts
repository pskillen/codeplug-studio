import type { GeoPoint } from '../models/libraryTypes.ts';

const EARTH_RADIUS_M = 6_371_000;
const M_PER_MI = 1609.344;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function normaliseBearingDeg(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Great-circle distance in metres (WGS84, no elevation). */
export function haversineDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/** Initial bearing from point 1 to point 2, degrees true (0–360). */
export function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normaliseBearingDeg(toDegrees(Math.atan2(y, x)));
}

/** Reciprocal bearing (opposite direction), degrees true (0–360). */
export function reciprocalBearingDeg(bearingDeg: number): number {
  return normaliseBearingDeg(bearingDeg + 180);
}

const COMPASS_OCTANTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/** Compass octant for a true bearing (N, NE, E, …). */
export function compassOctant(bearingDeg: number): (typeof COMPASS_OCTANTS)[number] {
  const index = Math.round(normaliseBearingDeg(bearingDeg) / 45) % 8;
  return COMPASS_OCTANTS[index];
}

/** Format metres for display: metres below 1 km, kilometres at/above. */
export function formatDistanceM(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** Format metres as kilometres and miles for path summaries. */
export function formatDistanceKmAndMi(m: number): string {
  if (!Number.isFinite(m) || m < 0) return '—';
  const mi = m / M_PER_MI;
  if (m < 1000) {
    return `${Math.round(m)} m (${mi.toFixed(1)} mi)`;
  }
  return `${(m / 1000).toFixed(1)} km (${mi.toFixed(1)} mi)`;
}

export interface PathMetrics {
  distanceM: number;
  bearingAB: number;
  bearingBA: number;
}

/** Great-circle distance and bearings between two WGS84 points. */
export function pathMetricsBetween(from: GeoPoint, to: GeoPoint): PathMetrics {
  const distanceM = haversineDistanceM(from.lat, from.lon, to.lat, to.lon);
  const bearingAB = initialBearingDeg(from.lat, from.lon, to.lat, to.lon);
  return {
    distanceM,
    bearingAB,
    bearingBA: reciprocalBearingDeg(bearingAB),
  };
}

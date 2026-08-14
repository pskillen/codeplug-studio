import type { LatLon } from '../geo.ts';
import { destinationPoint, haversineDistanceM } from '../geoDistance.ts';
import { GROUNDWAVE_MAX_RANGE_KM } from './rayTrace.ts';
import type { RayPathResult } from './types.ts';

const DEFAULT_RING_POINT_COUNT = 72;

/**
 * Isotropic-approximation ring around a transmitter at a given radius — used for both the
 * skip-zone boundary and the NVIS-coverage disc. "Isotropic" because v1's single-bearing ray
 * trace can't produce a true per-azimuth boundary; this ring is a simplification, not derived
 * from a full azimuth sweep.
 */
export function computePropagationRing(
  txLat: number,
  txLon: number,
  radiusM: number,
  pointCount: number = DEFAULT_RING_POINT_COUNT,
): LatLon[] {
  const points: LatLon[] = [];
  for (let i = 0; i <= pointCount; i += 1) {
    const bearingDeg = (360 * i) / pointCount;
    const dest = destinationPoint(txLat, txLon, bearingDeg, radiusM);
    points.push([dest.lat, dest.lon]);
  }
  return points;
}

function landingDistanceM(ray: RayPathResult, txLat: number, txLon: number): number | null {
  const landing = [...ray.points].reverse().find((p) => p.altitudeKm === 0) ?? ray.points.at(-1);
  if (!landing) return null;
  return haversineDistanceM(txLat, txLon, landing.lat, landing.lon);
}

/**
 * Outer edge of the skip-zone / NVIS-coverage ring: nearest skywave or NVIS landing distance
 * from the transmitter. Inner edge is `GROUNDWAVE_MAX_RANGE_KM`. Returns `null` when no
 * skywave/NVIS ray exists to bound it.
 */
export function skipZoneOuterRadiusM(
  rays: RayPathResult[],
  txLat: number,
  txLon: number,
): number | null {
  let nearest: number | null = null;
  for (const ray of rays) {
    if (ray.mode !== 'skywave' && ray.mode !== 'nvis') continue;
    const distanceM = landingDistanceM(ray, txLat, txLon);
    if (distanceM == null) continue;
    if (nearest == null || distanceM < nearest) nearest = distanceM;
  }
  return nearest;
}

export { GROUNDWAVE_MAX_RANGE_KM };

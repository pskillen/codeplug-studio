import type { LatLon } from '@core/domain/geo.ts';
import type { RayPathResult } from '@core/domain/hfPropagation/types.ts';

/**
 * Ground track of the first traced ray (v1 single-bearing fan — the map shows one
 * takeoff, not every elevation in the Worker result). Empty when no rays yet.
 */
export function rayGroundTrack(rays: RayPathResult[]): LatLon[] {
  const ray = rays[0];
  if (!ray) return [];
  return ray.points.map((p) => [p.lat, p.lon] as LatLon);
}

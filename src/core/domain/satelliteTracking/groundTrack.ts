import { eciToGeodetic, gstime, propagate, radiansToDegrees, twoline2satrec } from 'satellite.js';
import type { LatLon } from '../geo.ts';

const DEFAULT_STEP_SEC = 30;

/**
 * Sample a satellite's subsatellite ground track between two instants. Pure,
 * core-safe (no DOM/Worker globals) — same category as `passPrediction.ts`.
 */
export function sampleGroundTrack(
  tleLine1: string,
  tleLine2: string,
  fromAt: string,
  toAt: string,
  stepSec: number = DEFAULT_STEP_SEC,
): LatLon[] {
  const satrec = twoline2satrec(tleLine1, tleLine2);
  const fromMs = new Date(fromAt).getTime();
  const toMs = new Date(toAt).getTime();
  const stepMs = stepSec * 1000;

  const points: LatLon[] = [];
  for (let t = fromMs; t <= toMs; t += stepMs) {
    const date = new Date(t);
    const positionAndVelocity = propagate(satrec, date);
    if (!positionAndVelocity?.position) continue;

    const gmst = gstime(date);
    const geodetic = eciToGeodetic(positionAndVelocity.position, gmst);
    points.push([radiansToDegrees(geodetic.latitude), radiansToDegrees(geodetic.longitude)]);
  }
  return points;
}

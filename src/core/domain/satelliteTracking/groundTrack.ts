import { eciToGeodetic, gstime, propagate, radiansToDegrees, twoline2satrec } from 'satellite.js';
import type { LatLon } from '../geo.ts';

const DEFAULT_STEP_SEC = 30;

export interface OrbitSample {
  lat: number;
  lon: number;
  altitudeKm: number;
}

function sampleOrbitBetween(
  tleLine1: string,
  tleLine2: string,
  fromAt: string,
  toAt: string,
  stepSec: number,
): OrbitSample[] {
  const satrec = twoline2satrec(tleLine1, tleLine2);
  const fromMs = new Date(fromAt).getTime();
  const toMs = new Date(toAt).getTime();
  const stepMs = stepSec * 1000;

  const samples: OrbitSample[] = [];
  for (let t = fromMs; t <= toMs; t += stepMs) {
    const date = new Date(t);
    const positionAndVelocity = propagate(satrec, date);
    if (!positionAndVelocity?.position) continue;

    const gmst = gstime(date);
    const geodetic = eciToGeodetic(positionAndVelocity.position, gmst);
    samples.push({
      lat: radiansToDegrees(geodetic.latitude),
      lon: radiansToDegrees(geodetic.longitude),
      altitudeKm: geodetic.height,
    });
  }
  return samples;
}

/**
 * Sample a satellite orbit between two instants, including altitude at each step.
 */
export function sampleOrbitTrack(
  tleLine1: string,
  tleLine2: string,
  fromAt: string,
  toAt: string,
  stepSec: number = DEFAULT_STEP_SEC,
): OrbitSample[] {
  return sampleOrbitBetween(tleLine1, tleLine2, fromAt, toAt, stepSec);
}

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
  return sampleOrbitBetween(tleLine1, tleLine2, fromAt, toAt, stepSec).map((sample) => [
    sample.lat,
    sample.lon,
  ]);
}

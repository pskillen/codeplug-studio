import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  propagate,
  radiansToDegrees,
  twoline2satrec,
} from 'satellite.js';
import type { ObserverLocation, PassPredictionWindow, PassResult } from './types.ts';

const DEFAULT_STEP_MINUTES = 1;

/**
 * Sweep a TLE forward through a time window and find every pass (elevation
 * crossing above 0°) as seen by the observer. Pure function — no Worker glue
 * here, see `src/integrations/satelliteTracking/` for the Worker boundary.
 *
 * Resolution is capped at `stepMinutes` (default 1) — AOS/LOS times are not
 * sub-step interpolated, matching the design doc's ~1-minute sweep intent.
 */
export function computePassesForSatellite(
  tleLine1: string,
  tleLine2: string,
  observer: ObserverLocation,
  window: PassPredictionWindow,
): PassResult[] {
  const satrec = twoline2satrec(tleLine1, tleLine2);
  const observerGeodetic = {
    longitude: degreesToRadians(observer.lonDeg),
    latitude: degreesToRadians(observer.latDeg),
    height: observer.heightKm ?? 0,
  };

  const stepMs = (window.stepMinutes ?? DEFAULT_STEP_MINUTES) * 60_000;
  const fromMs = new Date(window.fromAt).getTime();
  const toMs = new Date(window.toAt).getTime();

  const passes: PassResult[] = [];
  let inPass = false;
  let aosMs = 0;
  let maxElevationDeg = -90;
  let maxElevationMs = fromMs;

  for (let t = fromMs; t <= toMs; t += stepMs) {
    const date = new Date(t);
    const positionAndVelocity = propagate(satrec, date);
    if (!positionAndVelocity?.position) {
      continue;
    }

    const gmst = gstime(date);
    const positionEcf = eciToEcf(positionAndVelocity.position, gmst);
    const lookAngles = ecfToLookAngles(observerGeodetic, positionEcf);
    const elevationDeg = radiansToDegrees(lookAngles.elevation);

    if (!inPass) {
      if (elevationDeg > 0) {
        inPass = true;
        aosMs = t;
        maxElevationDeg = elevationDeg;
        maxElevationMs = t;
      }
      continue;
    }

    if (elevationDeg > maxElevationDeg) {
      maxElevationDeg = elevationDeg;
      maxElevationMs = t;
    }

    if (elevationDeg <= 0) {
      passes.push({
        aosAt: new Date(aosMs).toISOString(),
        losAt: date.toISOString(),
        maxElevationAt: new Date(maxElevationMs).toISOString(),
        maxElevationDeg,
        durationSec: Math.round((t - aosMs) / 1000),
      });
      inPass = false;
    }
  }

  if (inPass) {
    passes.push({
      aosAt: new Date(aosMs).toISOString(),
      losAt: new Date(toMs).toISOString(),
      maxElevationAt: new Date(maxElevationMs).toISOString(),
      maxElevationDeg,
      durationSec: Math.round((toMs - aosMs) / 1000),
    });
  }

  return passes;
}

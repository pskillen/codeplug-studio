import {
  degreesToRadians,
  dopplerFactor,
  eciToEcf,
  geodeticToEcf,
  gstime,
  propagate,
  twoline2satrec,
} from 'satellite.js';
import type { ObserverLocation } from './types.ts';

/**
 * Doppler shift factor (observed / transmitted) for a satellite pass at a given instant, as
 * seen by a ground observer. Pure, core-safe (no DOM/Worker globals) — same category as
 * `passPrediction.ts` and `footprint.ts`.
 *
 * Reuses `satellite.js`'s own `dopplerFactor` helper rather than hand-deriving the relative
 * line-of-sight velocity: it already implements `1 - rangeRate/c` (the same formula this
 * module is asked for) with the Earth-rotation correction on the observer's ECF velocity
 * baked in. Multiply a transmit frequency by the returned factor to get the observed
 * frequency: `f_observed = f_tx * factor`.
 */
export function computeDopplerFactor(
  tleLine1: string,
  tleLine2: string,
  observer: ObserverLocation,
  at: string,
): number | null {
  const satrec = twoline2satrec(tleLine1, tleLine2);
  const date = new Date(at);
  const positionAndVelocity = propagate(satrec, date);
  if (!positionAndVelocity?.position || !positionAndVelocity?.velocity) return null;

  const gmst = gstime(date);
  const positionEcf = eciToEcf(positionAndVelocity.position, gmst);
  const velocityEcf = eciToEcf(positionAndVelocity.velocity, gmst);
  const observerEcf = geodeticToEcf({
    longitude: degreesToRadians(observer.lonDeg),
    latitude: degreesToRadians(observer.latDeg),
    height: observer.heightKm ?? 0,
  });

  const factor = dopplerFactor(observerEcf, positionEcf, velocityEcf);
  // A malformed/decayed TLE can still produce a `satrec` that "propagates" to NaN position
  // components rather than a falsy result — guard the output, not just the input shape.
  return Number.isFinite(factor) ? factor : null;
}

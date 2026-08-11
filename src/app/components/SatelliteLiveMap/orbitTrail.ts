import type { LatLon } from '@core/domain/geo.ts';
import { sampleGroundTrack } from '@core/domain/satelliteTracking/groundTrack.ts';
import { splitAtAntimeridian } from '../SatelliteTrackMap/mapHelpers.ts';

const DEFAULT_GROUND_TRACK_STEP_SEC = 30;
/** Default orbit count each side of the anchor for the detail live map. */
export const DEFAULT_ORBIT_TRAIL_MULTIPLE = 1.5;

export interface OrbitTrailSegments {
  /** Orbit-ahead ground track, split into antimeridian-safe segments. Draw solid. */
  futureSegments: LatLon[][];
  /** Orbit-behind ground track, split into antimeridian-safe segments. Draw dashed. */
  pastSegments: LatLon[][];
}

/**
 * Compute the two orbit-trail ground-track segments for a satellite's live map, anchored at
 * `anchorAtMs` (typically mount time). Each side spans `orbitTrailMultiple` orbital periods.
 *
 * Orbital period is derived from `meanMotionRevPerDay` (already on `Satellite`):
 * `periodMinutes = 1440 / meanMotionRevPerDay`.
 *
 * Antimeridian handling is applied **independently** to the future and past ground tracks —
 * they're sampled from two separate, non-adjacent time windows, so splitting a single
 * combined polyline would not be equivalent to splitting each segment on its own.
 */
export function computeOrbitTrailSegments(
  tleLine1: string,
  tleLine2: string,
  meanMotionRevPerDay: number,
  anchorAtMs: number,
  stepSec: number = DEFAULT_GROUND_TRACK_STEP_SEC,
  orbitTrailMultiple: number = DEFAULT_ORBIT_TRAIL_MULTIPLE,
): OrbitTrailSegments {
  const periodMinutes = 1440 / meanMotionRevPerDay;
  const windowMs = orbitTrailMultiple * periodMinutes * 60_000;

  const anchorIso = new Date(anchorAtMs).toISOString();
  const futureToIso = new Date(anchorAtMs + windowMs).toISOString();
  const pastFromIso = new Date(anchorAtMs - windowMs).toISOString();

  const futurePoints = sampleGroundTrack(tleLine1, tleLine2, anchorIso, futureToIso, stepSec);
  const pastPoints = sampleGroundTrack(tleLine1, tleLine2, pastFromIso, anchorIso, stepSec);

  return {
    futureSegments: splitAtAntimeridian(futurePoints),
    pastSegments: splitAtAntimeridian(pastPoints),
  };
}

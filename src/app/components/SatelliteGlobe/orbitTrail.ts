import type { LatLon } from '@core/domain/geo.ts';
import { sampleGroundTrack } from '@core/domain/satelliteTracking/groundTrack.ts';

const DEFAULT_GROUND_TRACK_STEP_SEC = 30;

export interface GlobeOrbitTrail {
  /** Ground track ahead of the anchor instant, half the orbital period — draw solid. */
  futurePoints: LatLon[];
  /** Ground track behind the anchor instant, half the orbital period — draw dashed. */
  pastPoints: LatLon[];
}

/**
 * Compute a ~90-minute orbit trail (one full orbital period, half ahead of the anchor
 * instant and half behind) for the 3D globe. Sibling to
 * `SatelliteLiveMap/orbitTrail.ts#computeOrbitTrailSegments`, not a reuse of it directly:
 * that function hardcodes a 1.5-orbit window and returns antimeridian-split segments for
 * Leaflet polylines, neither of which fits here — a 3D globe wraps longitude natively, and
 * this ticket wants a single-orbit ~90-minute trail rather than 1.5 orbits. Both functions
 * share the same underlying `sampleGroundTrack` core call and the same
 * `periodMinutes = 1440 / meanMotionRevPerDay` derivation — a typical LEO period is close to
 * 90 minutes, but it's computed per-satellite here, never hardcoded.
 */
export function computeGlobeOrbitTrail(
  tleLine1: string,
  tleLine2: string,
  meanMotionRevPerDay: number,
  anchorAtMs: number,
  stepSec: number = DEFAULT_GROUND_TRACK_STEP_SEC,
): GlobeOrbitTrail {
  const periodMinutes = 1440 / meanMotionRevPerDay;
  const halfWindowMs = (periodMinutes / 2) * 60_000;

  const anchorIso = new Date(anchorAtMs).toISOString();
  const futureToIso = new Date(anchorAtMs + halfWindowMs).toISOString();
  const pastFromIso = new Date(anchorAtMs - halfWindowMs).toISOString();

  return {
    futurePoints: sampleGroundTrack(tleLine1, tleLine2, anchorIso, futureToIso, stepSec),
    pastPoints: sampleGroundTrack(tleLine1, tleLine2, pastFromIso, anchorIso, stepSec),
  };
}

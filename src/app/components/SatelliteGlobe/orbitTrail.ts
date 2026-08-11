import { sampleOrbitTrack, type OrbitSample } from '@core/domain/satelliteTracking/groundTrack.ts';

const DEFAULT_GROUND_TRACK_STEP_SEC = 30;

/** Dashboard default — look-behind window in wall-clock minutes. */
export const DEFAULT_GLOBE_LOOK_BEHIND_MIN = 15;
/** Dashboard default — look-ahead window in wall-clock minutes. */
export const DEFAULT_GLOBE_LOOK_AHEAD_MIN = 30;

export const MIN_GLOBE_TRAIL_MIN = 0;
export const MAX_GLOBE_TRAIL_MIN = 24 * 60;
export const GLOBE_TRAIL_STEP_MIN = 5;

export function clampGlobeTrailMinutes(value: number, fallback: number): number {
  if (Number.isNaN(value)) return fallback;
  const clamped = Math.min(MAX_GLOBE_TRAIL_MIN, Math.max(MIN_GLOBE_TRAIL_MIN, value));
  return Math.round(clamped / GLOBE_TRAIL_STEP_MIN) * GLOBE_TRAIL_STEP_MIN;
}

export interface GlobeOrbitTrail {
  /** Orbit ahead of the anchor instant — draw solid, fading to gray. */
  futurePoints: OrbitSample[];
  /** Orbit behind the anchor instant — draw dashed, fading from gray. */
  pastPoints: OrbitSample[];
}

/**
 * Compute orbit-trail samples for the 3D globe, anchored at `anchorAtMs` (typically mount
 * time). Windows are wall-clock minutes relative to the anchor, not orbital periods — sibling
 * to `SatelliteLiveMap/orbitTrail.ts#computeOrbitTrailSegments`, which uses orbit multiples
 * and antimeridian-split ground tracks for Leaflet.
 */
export function computeGlobeOrbitTrail(
  tleLine1: string,
  tleLine2: string,
  anchorAtMs: number,
  lookBehindMin: number,
  lookAheadMin: number,
  stepSec: number = DEFAULT_GROUND_TRACK_STEP_SEC,
): GlobeOrbitTrail {
  const anchorIso = new Date(anchorAtMs).toISOString();
  const futureToIso = new Date(anchorAtMs + lookAheadMin * 60_000).toISOString();
  const pastFromIso = new Date(anchorAtMs - lookBehindMin * 60_000).toISOString();

  return {
    futurePoints:
      lookAheadMin > 0 ? sampleOrbitTrack(tleLine1, tleLine2, anchorIso, futureToIso, stepSec) : [],
    pastPoints:
      lookBehindMin > 0
        ? sampleOrbitTrack(tleLine1, tleLine2, pastFromIso, anchorIso, stepSec)
        : [],
  };
}

import { useEffect, useState } from 'react';
import { eciToGeodetic, gstime, propagate, radiansToDegrees, twoline2satrec } from 'satellite.js';
import type { LatLon } from '@core/domain/geo.ts';

const DEFAULT_POLL_INTERVAL_MS = 10000;

const POSITION_EPSILON_DEG = 1e-4;
const ALTITUDE_EPSILON_KM = 0.01;

function livePositionNearlyEqual(a: LiveSatellitePosition, b: LiveSatellitePosition): boolean {
  return (
    Math.abs(a.position[0] - b.position[0]) < POSITION_EPSILON_DEG &&
    Math.abs(a.position[1] - b.position[1]) < POSITION_EPSILON_DEG &&
    Math.abs(a.altitudeKm - b.altitudeKm) < ALTITUDE_EPSILON_KM
  );
}

export interface GlobeSatelliteInput {
  id: string;
  tleLine1: string;
  tleLine2: string;
}

export interface LiveSatellitePosition {
  /** Subsatellite point at the last poll — `[lat, lon]` degrees. */
  position: LatLon;
  /** Altitude above the WGS84 ellipsoid, km. */
  altitudeKm: number;
  /** Wall-clock instant the position was computed, ISO 8601. */
  at: string;
}

/**
 * Live-updating subsatellite points for many satellites at once, re-propagated on a shared
 * poll interval. `useLiveSatellitePosition` (`src/app/routes/tracking/useLiveSatellitePosition.ts`)
 * only tracks one satellite — it was built for the single-satellite detail page and calling
 * a hook once per array entry would violate the rules of hooks — so this is a small
 * multi-satellite variant local to the globe, sharing the same `satellite.js` propagation
 * calls rather than re-deriving them. Keyed by `id` so callers can look up a satellite's
 * current position without re-matching on TLE strings.
 */
export function useLiveSatellitePositions(
  satellites: GlobeSatelliteInput[],
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): Map<string, LiveSatellitePosition> {
  const [positions, setPositions] = useState<Map<string, LiveSatellitePosition>>(new Map());

  // Stable key so the effect only restarts when the actual satellite set changes, not on
  // every parent re-render passing a fresh array/object identity.
  const satelliteKey = satellites.map((s) => `${s.id}:${s.tleLine1}:${s.tleLine2}`).join('|');

  useEffect(() => {
    if (satellites.length === 0) {
      const timer = setTimeout(() => setPositions(new Map()), 0);
      return () => clearTimeout(timer);
    }

    const satrecs = satellites.map((satellite) => ({
      id: satellite.id,
      satrec: twoline2satrec(satellite.tleLine1, satellite.tleLine2),
    }));

    const tick = () => {
      const date = new Date();
      const gmst = gstime(date);
      setPositions((prev) => {
        const next = new Map<string, LiveSatellitePosition>();
        for (const { id, satrec } of satrecs) {
          const positionAndVelocity = propagate(satrec, date);
          if (!positionAndVelocity?.position) continue;
          const geodetic = eciToGeodetic(positionAndVelocity.position, gmst);
          const candidate: LiveSatellitePosition = {
            position: [radiansToDegrees(geodetic.latitude), radiansToDegrees(geodetic.longitude)],
            altitudeKm: geodetic.height,
            at: date.toISOString(),
          };
          const previous = prev.get(id);
          next.set(
            id,
            previous && livePositionNearlyEqual(previous, candidate) ? previous : candidate,
          );
        }
        if (
          prev.size === next.size &&
          [...next.entries()].every(([id, value]) => prev.get(id) === value)
        ) {
          return prev;
        }
        return next;
      });
    };

    // Deferred a tick, matching `useLiveSatellitePosition`'s no-sync-setState-in-effect
    // convention, so the caller isn't left with stale/empty positions for a full poll interval.
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, pollIntervalMs);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- satelliteKey is the intentional dep
  }, [satelliteKey, pollIntervalMs]);

  return positions;
}

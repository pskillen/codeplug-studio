import { useEffect, useState } from 'react';
import { eciToGeodetic, gstime, propagate, radiansToDegrees, twoline2satrec } from 'satellite.js';
import type { LatLon } from '@core/domain/geo.ts';

/** How often the live position re-propagates, ms. Presentation-layer polling — a single
 * `propagate` call is cheap enough not to warrant routing through the pass-prediction Worker. */
const DEFAULT_POLL_INTERVAL_MS = 2000;

export interface LiveSatellitePosition {
  /** Subsatellite point at the last poll — `[lat, lon]` degrees. */
  position: LatLon;
  /** Altitude above the WGS84 ellipsoid, km. */
  altitudeKm: number;
  /** Wall-clock instant the position was computed, ISO 8601. */
  at: string;
}

/**
 * Live-updating subsatellite point for one satellite, re-propagated from its TLE on a
 * fixed interval. Colocated under `src/app/routes/tracking/` since nothing else needs it
 * yet (see `SatelliteDetailPage`). Returns `null` until the first propagation succeeds or
 * while `tleLine1`/`tleLine2` are absent.
 */
export function useLiveSatellitePosition(
  tleLine1: string | null,
  tleLine2: string | null,
  pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
): LiveSatellitePosition | null {
  const [position, setPosition] = useState<LiveSatellitePosition | null>(null);

  useEffect(() => {
    if (!tleLine1 || !tleLine2) {
      const timer = setTimeout(() => setPosition(null), 0);
      return () => clearTimeout(timer);
    }

    const satrec = twoline2satrec(tleLine1, tleLine2);

    const tick = () => {
      const date = new Date();
      const positionAndVelocity = propagate(satrec, date);
      if (!positionAndVelocity?.position) return;

      const gmst = gstime(date);
      const geodetic = eciToGeodetic(positionAndVelocity.position, gmst);
      setPosition({
        position: [radiansToDegrees(geodetic.latitude), radiansToDegrees(geodetic.longitude)],
        altitudeKm: geodetic.height,
        at: date.toISOString(),
      });
    };

    // Compute immediately (deferred a tick, to satisfy the no-sync-setState-in-effect
    // rule) so the caller isn't left with a stale/null position for a full poll interval.
    const initial = setTimeout(tick, 0);
    const interval = setInterval(tick, pollIntervalMs);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [tleLine1, tleLine2, pollIntervalMs]);

  return position;
}

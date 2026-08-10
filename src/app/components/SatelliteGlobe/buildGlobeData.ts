import type { LatLon } from '@core/domain/geo.ts';
import { computeSatelliteFootprint } from '@core/domain/satelliteTracking/footprint.ts';
import { computeGlobeOrbitTrail } from './orbitTrail.ts';
import type { LiveSatellitePosition } from './useLiveSatellitePositions.ts';

export interface GlobeSatellite {
  id: string;
  name: string;
  tleLine1: string;
  tleLine2: string;
  meanMotionRevPerDay: number;
}

export type GlobePointKind = 'observer' | 'satellite';

export interface GlobePoint {
  kind: GlobePointKind;
  id: string;
  name: string;
  lat: number;
  lng: number;
  altitudeKm: number;
  selected: boolean;
}

export type GlobePathKind = 'trail-past' | 'trail-future' | 'footprint';

export interface GlobePath {
  kind: GlobePathKind;
  satelliteId: string;
  /** `[lat, lng, altitude]` triples — altitude is a fraction of globe radius (react-globe.gl convention). */
  points: [number, number, number][];
}

export interface GlobeData {
  points: GlobePoint[];
  paths: GlobePath[];
}

/**
 * Matches `TrackingSettings.location` (`GeoPoint`, `src/core/models/libraryTypes.ts`) shape —
 * kept as an inline structural type here rather than importing `GeoPoint`, same convention as
 * `SatelliteTrackMap`'s `observer` prop.
 */
export interface GlobeObserver {
  lat: number;
  lon: number;
}

function toPathPoints(latLons: LatLon[], altitude: number): [number, number, number][] {
  return latLons.map(([lat, lon]) => [lat, lon, altitude]);
}

/**
 * Orbit-trail paths only (past + future per satellite) — split out from
 * `computeGlobePointsAndFootprints` below so `SatelliteGlobe` can memoize it independently,
 * keyed only on `satellites`/`anchorAtMs`. Trails are SGP4-sampled at ~180 points each
 * (90-minute window / 30s step) per satellite; with dozens of enabled satellites, redoing
 * that work on every 2-second live-position poll tick (as a single combined computation
 * would, since it'd share a dependency array with the live positions) was measured to stall
 * the main thread — confirmed live-browser-testing with a 97-satellite CelesTrak amateur
 * fetch. `anchorAtMs` is fixed at mount by the caller, so this only needs to be recomputed
 * when the enabled-satellite set itself changes.
 */
export function computeGlobeTrailPaths(
  satellites: GlobeSatellite[],
  anchorAtMs: number,
): GlobePath[] {
  const paths: GlobePath[] = [];
  for (const satellite of satellites) {
    const trail = computeGlobeOrbitTrail(
      satellite.tleLine1,
      satellite.tleLine2,
      satellite.meanMotionRevPerDay,
      anchorAtMs,
    );
    paths.push({
      kind: 'trail-past',
      satelliteId: satellite.id,
      points: toPathPoints(trail.pastPoints, 0),
    });
    paths.push({
      kind: 'trail-future',
      satelliteId: satellite.id,
      points: toPathPoints(trail.futurePoints, 0),
    });
  }
  return paths;
}

export interface GlobePointsAndFootprints {
  points: GlobePoint[];
  footprintPaths: GlobePath[];
}

/**
 * Observer marker + live satellite dots + footprint circles — the parts of the globe's data
 * that legitimately depend on `livePositions` and so are recomputed on every poll tick.
 * Footprint circles are cheap (single `computeSatelliteFootprint` call per satellite, ~72
 * sampled points) compared to the orbit trails split into `computeGlobeTrailPaths` above, so
 * recomputing them every tick is fine.
 */
export function computeGlobePointsAndFootprints(
  observer: GlobeObserver | null,
  satellites: GlobeSatellite[],
  livePositions: Map<string, LiveSatellitePosition>,
  selectedSatelliteIds: Set<string>,
): GlobePointsAndFootprints {
  const points: GlobePoint[] = [];
  const footprintPaths: GlobePath[] = [];

  if (observer) {
    points.push({
      kind: 'observer',
      id: 'observer',
      name: 'Observer',
      lat: observer.lat,
      lng: observer.lon,
      altitudeKm: 0,
      selected: false,
    });
  }

  for (const satellite of satellites) {
    const live = livePositions.get(satellite.id);
    if (!live) continue;

    const selected = selectedSatelliteIds.size === 0 || selectedSatelliteIds.has(satellite.id);
    points.push({
      kind: 'satellite',
      id: satellite.id,
      name: satellite.name,
      lat: live.position[0],
      lng: live.position[1],
      altitudeKm: live.altitudeKm,
      selected,
    });

    const footprint = computeSatelliteFootprint(satellite.tleLine1, satellite.tleLine2, live.at);
    if (footprint) {
      footprintPaths.push({
        kind: 'footprint',
        satelliteId: satellite.id,
        points: toPathPoints(footprint.points, 0),
      });
    }
  }

  return { points, footprintPaths };
}

/**
 * Full-data convenience wrapper combining `computeGlobeTrailPaths` and
 * `computeGlobePointsAndFootprints` — used by tests and any caller that doesn't need the two
 * memoized independently. `SatelliteGlobe` itself calls the two split functions directly (see
 * their docs) so trail recomputation isn't tied to the live-position poll interval.
 */
export function buildGlobeData(
  observer: GlobeObserver | null,
  satellites: GlobeSatellite[],
  livePositions: Map<string, LiveSatellitePosition>,
  selectedSatelliteIds: Set<string>,
  anchorAtMs: number,
): GlobeData {
  const { points, footprintPaths } = computeGlobePointsAndFootprints(
    observer,
    satellites,
    livePositions,
    selectedSatelliteIds,
  );
  const trailPaths = computeGlobeTrailPaths(satellites, anchorAtMs);
  return { points, paths: [...trailPaths, ...footprintPaths] };
}

import type { LatLon } from '@core/domain/geo.ts';
import type { OrbitSample } from '@core/domain/satelliteTracking/groundTrack.ts';
import { computeSatelliteFootprint } from '@core/domain/satelliteTracking/footprint.ts';
import {
  computeGlobeOrbitTrail,
  DEFAULT_GLOBE_LOOK_AHEAD_MIN,
  DEFAULT_GLOBE_LOOK_BEHIND_MIN,
} from './orbitTrail.ts';
import { altitudeKmToGlobeRadiusUnits } from './globeAltitude.ts';
import type { LiveSatellitePosition } from './useLiveSatellitePositions.ts';
import { colorForNoradId } from '@core/domain/satelliteTracking/satelliteColor.ts';

/** Matches the observer marker colour used by `SatelliteGlobe.tsx`. */
const OBSERVER_POINT_COLOR = '#4d7cff';

export interface GlobeSatellite {
  id: string;
  name: string;
  noradId: number;
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
  /** Opaque CSS colour for satellite markers; unused for the observer. */
  color: string;
}

export type GlobePathKind = 'trail-past' | 'trail-future' | 'footprint';

export interface GlobePath {
  kind: GlobePathKind;
  satelliteId: string;
  /** `[lat, lng, altitude]` triples — altitude is a fraction of globe radius (react-globe.gl convention). */
  points: [number, number, number][];
  /** CSS colour for this path (footprints may use alpha). */
  color: string;
}

export interface GlobeData {
  points: GlobePoint[];
  paths: GlobePath[];
}

export interface GlobeTrailOptions {
  lookBehindMin?: number;
  lookAheadMin?: number;
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

function toSurfacePathPoints(latLons: LatLon[], altitude: number): [number, number, number][] {
  return latLons.map(([lat, lon]) => [lat, lon, altitude]);
}

function orbitSamplesToPathPoints(samples: OrbitSample[]): [number, number, number][] {
  return samples.map((sample) => [
    sample.lat,
    sample.lon,
    altitudeKmToGlobeRadiusUnits(sample.altitudeKm),
  ]);
}

const POSITION_EPSILON_DEG = 1e-4;
const ALTITUDE_EPSILON_KM = 0.01;

/** When an interest filter is active, only render these satellites on the globe. */
export function filterGlobeSatellitesByInterest(
  satellites: GlobeSatellite[],
  interestedSatelliteIds: Set<string>,
): GlobeSatellite[] {
  return satellites.filter((satellite) => interestedSatelliteIds.has(satellite.id));
}

function globePointNearlyEqual(a: GlobePoint, b: GlobePoint): boolean {
  return (
    a.kind === b.kind &&
    a.id === b.id &&
    a.name === b.name &&
    a.selected === b.selected &&
    a.color === b.color &&
    Math.abs(a.lat - b.lat) < POSITION_EPSILON_DEG &&
    Math.abs(a.lng - b.lng) < POSITION_EPSILON_DEG &&
    Math.abs(a.altitudeKm - b.altitudeKm) < ALTITUDE_EPSILON_KM
  );
}

function globePathNearlyEqual(a: GlobePath, b: GlobePath): boolean {
  if (a.kind !== b.kind || a.satelliteId !== b.satelliteId || a.color !== b.color) return false;
  if (a.points.length !== b.points.length) return false;
  for (let i = 0; i < a.points.length; i++) {
    const [alat, alng, aalt] = a.points[i];
    const [blat, blng, balt] = b.points[i];
    if (
      Math.abs(alat - blat) > POSITION_EPSILON_DEG ||
      Math.abs(alng - blng) > POSITION_EPSILON_DEG ||
      Math.abs(aalt - balt) > 1e-6
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Reuse prior point/path object references when geometry is unchanged so `react-globe.gl`
 * does not restart transition animations on every poll tick.
 */
export function stabilizeGlobePointsAndFootprints(
  next: GlobePointsAndFootprints,
  previous: GlobePointsAndFootprints | null,
): GlobePointsAndFootprints {
  if (!previous) return next;

  const prevPointByKey = new Map(
    previous.points.map((point) => [`${point.kind}:${point.id}`, point]),
  );
  const points = next.points.map((point) => {
    const prev = prevPointByKey.get(`${point.kind}:${point.id}`);
    return prev && globePointNearlyEqual(prev, point) ? prev : point;
  });

  const prevPathByKey = new Map(
    previous.footprintPaths.map((path) => [`${path.kind}:${path.satelliteId}`, path]),
  );
  const footprintPaths = next.footprintPaths.map((path) => {
    const prev = prevPathByKey.get(`${path.kind}:${path.satelliteId}`);
    return prev && globePathNearlyEqual(prev, path) ? prev : path;
  });

  return { points, footprintPaths };
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
  options: GlobeTrailOptions = {},
): GlobePath[] {
  const lookBehindMin = options.lookBehindMin ?? DEFAULT_GLOBE_LOOK_BEHIND_MIN;
  const lookAheadMin = options.lookAheadMin ?? DEFAULT_GLOBE_LOOK_AHEAD_MIN;
  const paths: GlobePath[] = [];
  for (const satellite of satellites) {
    const trail = computeGlobeOrbitTrail(
      satellite.tleLine1,
      satellite.tleLine2,
      anchorAtMs,
      lookBehindMin,
      lookAheadMin,
    );
    const color = colorForNoradId(satellite.noradId);
    paths.push({
      kind: 'trail-past',
      satelliteId: satellite.id,
      points: orbitSamplesToPathPoints(trail.pastPoints),
      color,
    });
    paths.push({
      kind: 'trail-future',
      satelliteId: satellite.id,
      points: orbitSamplesToPathPoints(trail.futurePoints),
      color,
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
  highlightedSatelliteIds: Set<string>,
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
      color: OBSERVER_POINT_COLOR,
    });
  }

  for (const satellite of satellites) {
    const live = livePositions.get(satellite.id);
    if (!live) continue;

    const selected =
      highlightedSatelliteIds.size === 0 || highlightedSatelliteIds.has(satellite.id);
    const color = colorForNoradId(satellite.noradId);
    points.push({
      kind: 'satellite',
      id: satellite.id,
      name: satellite.name,
      lat: live.position[0],
      lng: live.position[1],
      altitudeKm: live.altitudeKm,
      selected,
      color,
    });

    const footprint = computeSatelliteFootprint(satellite.tleLine1, satellite.tleLine2, live.at);
    if (footprint) {
      footprintPaths.push({
        kind: 'footprint',
        satelliteId: satellite.id,
        points: toSurfacePathPoints(footprint.points, 0),
        color: colorForNoradId(satellite.noradId, 0.45),
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
  highlightedSatelliteIds: Set<string>,
  anchorAtMs: number,
  trailOptions: GlobeTrailOptions = {},
): GlobeData {
  const { points, footprintPaths } = computeGlobePointsAndFootprints(
    observer,
    satellites,
    livePositions,
    highlightedSatelliteIds,
  );
  const trailPaths = computeGlobeTrailPaths(satellites, anchorAtMs, trailOptions);
  return { points, paths: [...trailPaths, ...footprintPaths] };
}

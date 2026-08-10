import {
  degreesToRadians,
  eciToGeodetic,
  gstime,
  propagate,
  radiansToDegrees,
  twoline2satrec,
} from 'satellite.js';
import type { LatLon } from '../geo.ts';

/** Mean Earth radius, km — same approximation used for the central-angle formula below. */
const EARTH_RADIUS_KM = 6371;

/** Number of points sampled around the footprint circle. */
const DEFAULT_POINT_COUNT = 72;

export interface SatelliteFootprint {
  /** Subsatellite point (directly below the satellite) — `[lat, lon]` degrees. */
  center: LatLon;
  /** Altitude above the WGS84 ellipsoid, km, as reported by `eciToGeodetic`. */
  altitudeKm: number;
  /** Great-circle angular radius of the visible-horizon circle, degrees. */
  angularRadiusDeg: number;
  /** Sampled points tracing the visible-horizon circle — `[lat, lon]` degrees, closed (first === last). */
  points: LatLon[];
}

/**
 * Compute a satellite's visible-horizon "footprint" circle at a given instant: the
 * great-circle boundary, centered on the subsatellite point, out to the radio horizon.
 * Pure, core-safe (no DOM/Worker globals) — same category as `passPrediction.ts` and
 * `groundTrack.ts`. Points are produced by hand-rolled great-circle sampling (bearing
 * walk around the center) rather than a geo library, matching this module's siblings'
 * zero-dependency style.
 */
export function computeSatelliteFootprint(
  tleLine1: string,
  tleLine2: string,
  at: string,
  pointCount: number = DEFAULT_POINT_COUNT,
): SatelliteFootprint | null {
  const satrec = twoline2satrec(tleLine1, tleLine2);
  const date = new Date(at);
  const positionAndVelocity = propagate(satrec, date);
  if (!positionAndVelocity?.position) return null;

  const gmst = gstime(date);
  const geodetic = eciToGeodetic(positionAndVelocity.position, gmst);
  const centerLatDeg = radiansToDegrees(geodetic.latitude);
  const centerLonDeg = radiansToDegrees(geodetic.longitude);
  const altitudeKm = geodetic.height;

  const angularRadiusDeg = footprintAngularRadiusDeg(altitudeKm);
  const points = sampleGreatCircle(centerLatDeg, centerLonDeg, angularRadiusDeg, pointCount);

  return {
    center: [centerLatDeg, centerLonDeg],
    altitudeKm,
    angularRadiusDeg,
    points,
  };
}

/**
 * Great-circle angular radius (degrees) of the visible-horizon circle for a satellite
 * at `altitudeKm` above a spherical Earth of radius `EARTH_RADIUS_KM`. Standard
 * radio/orbital-mechanics horizon formula: `centralAngle = acos(Re / (Re + altitude))`.
 * Clamped to a small positive altitude floor so pre-launch/decayed inputs (altitude <= 0)
 * don't feed `acos` a value outside its domain.
 */
export function footprintAngularRadiusDeg(altitudeKm: number): number {
  const safeAltitudeKm = Math.max(altitudeKm, 1e-6);
  const ratio = EARTH_RADIUS_KM / (EARTH_RADIUS_KM + safeAltitudeKm);
  const centralAngleRad = Math.acos(Math.min(1, Math.max(-1, ratio)));
  return radiansToDegrees(centralAngleRad);
}

/**
 * Sample `pointCount` points evenly spaced (by bearing) around the great-circle of
 * angular radius `radiusDeg` centered on `[centerLatDeg, centerLonDeg]`. Uses the
 * standard spherical "destination point given distance and bearing" formula, walking
 * bearing from 0 to 360 degrees. The returned ring is closed (first point repeated last)
 * so callers can hand it straight to a polygon/polyline renderer.
 */
export function sampleGreatCircle(
  centerLatDeg: number,
  centerLonDeg: number,
  radiusDeg: number,
  pointCount: number = DEFAULT_POINT_COUNT,
): LatLon[] {
  const centerLatRad = degreesToRadians(centerLatDeg);
  const centerLonRad = degreesToRadians(centerLonDeg);
  const angularRadiusRad = degreesToRadians(radiusDeg);

  const points: LatLon[] = [];
  for (let i = 0; i <= pointCount; i += 1) {
    const bearingRad = (2 * Math.PI * i) / pointCount;

    const latRad = Math.asin(
      Math.sin(centerLatRad) * Math.cos(angularRadiusRad) +
        Math.cos(centerLatRad) * Math.sin(angularRadiusRad) * Math.cos(bearingRad),
    );
    const lonRad =
      centerLonRad +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(angularRadiusRad) * Math.cos(centerLatRad),
        Math.cos(angularRadiusRad) - Math.sin(centerLatRad) * Math.sin(latRad),
      );

    // Normalize longitude to [-180, 180].
    const normalizedLonDeg = ((radiansToDegrees(lonRad) + 540) % 360) - 180;
    points.push([radiansToDegrees(latRad), normalizedLonDeg]);
  }
  return points;
}

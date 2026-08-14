import type { LatLon } from '../geo.ts';
import { solarGeometryAt } from './solarZenithAngle.ts';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function geoToCartesian(latDeg: number, lonDeg: number): Vec3 {
  const latRad = latDeg * DEG_TO_RAD;
  const lonRad = lonDeg * DEG_TO_RAD;
  const cosLat = Math.cos(latRad);
  return {
    x: cosLat * Math.cos(lonRad),
    y: cosLat * Math.sin(lonRad),
    z: Math.sin(latRad),
  };
}

function cartesianToGeo(v: Vec3): LatLon {
  const r = Math.hypot(v.x, v.y, v.z) || 1;
  const latDeg = Math.asin(v.z / r) * RAD_TO_DEG;
  const lonDeg = Math.atan2(v.y, v.x) * RAD_TO_DEG;
  return [latDeg, lonDeg];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Vec3): Vec3 {
  const r = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / r, y: v.y / r, z: v.z / r };
}

function rotateAroundAxis(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const c = cross(axis, v);
  const dot = axis.x * v.x + axis.y * v.y + axis.z * v.z;
  const oneMinusCos = 1 - cos;
  return {
    x: v.x * cos + c.x * sin + axis.x * dot * oneMinusCos,
    y: v.y * cos + c.y * sin + axis.y * dot * oneMinusCos,
    z: v.z * cos + c.z * sin + axis.z * dot * oneMinusCos,
  };
}

function perpendicularTo(u: Vec3): Vec3 {
  const helper = Math.abs(u.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
  return normalize(cross(u, helper));
}

/** Geographic lat/lon where the sun is directly overhead (zenith 0°) at `atMs`. */
export function computeSubsolarPoint(atMs: number): LatLon {
  const { subsolarLatDeg, subsolarLonDeg } = solarGeometryAt(atMs);
  return [subsolarLatDeg, subsolarLonDeg];
}

/**
 * Samples the day/night terminator as a closed ring of lat/lon points (zenith angle == 90°),
 * for rendering a greyline band on the globe. Pure function — no rendering types.
 */
export function computeSolarTerminator(atMs: number, pointCount = 180): LatLon[] {
  const count = Math.max(8, Math.floor(pointCount));
  const [sunLat, sunLon] = computeSubsolarPoint(atMs);
  const sun = geoToCartesian(sunLat, sunLon);
  const start = perpendicularTo(sun);
  const points: LatLon[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    points.push(cartesianToGeo(rotateAroundAxis(start, sun, angle)));
  }
  const first = points[0];
  if (first) points.push(first);
  return points;
}

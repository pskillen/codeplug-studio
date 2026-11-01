import type { GeoPoint } from '../models/libraryTypes.ts';
import {
  compassOctant,
  haversineDistanceM,
  initialBearingDeg,
  pathMetricsBetween,
} from './geoDistance.ts';
import { isValidLocator } from './maidenhead.ts';

/**
 * Pure helpers shared by the Field tools (My locator, Distance & bearing, Nearby repeaters):
 * distance units, nearest-first ranking, locator square bounds and URL point parsing.
 */

export type DistanceUnit = 'km' | 'mi';

const M_PER_MI = 1609.344;

export function metresToUnit(m: number, unit: DistanceUnit): number {
  return unit === 'mi' ? m / M_PER_MI : m / 1000;
}

export function unitToMetres(value: number, unit: DistanceUnit): number {
  return unit === 'mi' ? value * M_PER_MI : value * 1000;
}

/** Short distance label: "1.1 mi", "12 km", "850 m" for very short hops. */
export function formatDistanceInUnit(m: number, unit: DistanceUnit): string {
  if (!Number.isFinite(m) || m < 0) return '—';
  const short = unit === 'mi' ? m < 160 : m < 1000;
  if (short) return `${Math.round(m)} m`;
  const v = metresToUnit(m, unit);
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${unit}`;
}

/** "146° SE" — true bearing rounded to whole degrees plus compass octant. */
export function formatBearingLabel(bearingDeg: number): string {
  const rounded = Math.round(bearingDeg) % 360;
  return `${rounded}° ${compassOctant(bearingDeg)}`;
}

export interface RankedByDistance<T> {
  item: T;
  distanceM: number;
  bearingDeg: number;
}

/**
 * Items within `radiusM` of `origin`, nearest first. Items without a usable location are dropped.
 * Ties keep input order (stable sort).
 */
export function rankByDistance<T>(
  items: readonly T[],
  origin: GeoPoint,
  getPoint: (item: T) => GeoPoint | null | undefined,
  radiusM: number,
): RankedByDistance<T>[] {
  const ranked: RankedByDistance<T>[] = [];
  for (const item of items) {
    const p = getPoint(item);
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    const distanceM = haversineDistanceM(origin.lat, origin.lon, p.lat, p.lon);
    if (distanceM > radiusM) continue;
    ranked.push({
      item,
      distanceM,
      bearingDeg: initialBearingDeg(origin.lat, origin.lon, p.lat, p.lon),
    });
  }
  return ranked.sort((a, b) => a.distanceM - b.distanceM);
}

export { pathMetricsBetween };

export interface LatLonBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Bounding box of a Maidenhead locator square (4, 6, 8 or 10 characters). */
export function locatorSquareBounds(locator: string): LatLonBounds | null {
  const s = locator.trim().toUpperCase().replace(/\s/g, '');
  if (!isValidLocator(s)) return null;
  let lon = (s.charCodeAt(0) - 65) * 20;
  let lat = (s.charCodeAt(1) - 65) * 10;
  let lonSize = 20;
  let latSize = 10;
  if (s.length >= 4) {
    lon += Number.parseInt(s[2], 10) * 2;
    lat += Number.parseInt(s[3], 10);
    lonSize = 2;
    latSize = 1;
  }
  if (s.length >= 6) {
    lon += (s.charCodeAt(4) - 65) * (2 / 24);
    lat += (s.charCodeAt(5) - 65) * (1 / 24);
    lonSize = 2 / 24;
    latSize = 1 / 24;
  }
  if (s.length >= 8) {
    lon += Number.parseInt(s[6], 10) * (2 / 240);
    lat += Number.parseInt(s[7], 10) * (1 / 240);
    lonSize = 2 / 240;
    latSize = 1 / 240;
  }
  if (s.length >= 10) {
    lon += (s.charCodeAt(8) - 65) * (2 / 240 / 24);
    lat += (s.charCodeAt(9) - 65) * (1 / 240 / 24);
    lonSize = 2 / 240 / 24;
    latSize = 1 / 240 / 24;
  }
  const south = lat - 90;
  const west = lon - 180;
  return { south, west, north: south + latSize, east: west + lonSize };
}

const M_PER_DEG_LAT = 111_195;

/**
 * 4-character locator squares whose area may intersect the circle of `radiusM` around `centre`.
 * Used to turn a "within N of here" query into per-square directory requests.
 */
export function coveringLocatorSquares(centre: GeoPoint, radiusM: number): string[] {
  const dLat = radiusM / M_PER_DEG_LAT;
  const cosLat = Math.max(0.05, Math.cos((Math.min(89, Math.abs(centre.lat)) * Math.PI) / 180));
  const dLon = radiusM / (M_PER_DEG_LAT * cosLat);
  const south = Math.max(-89.999, centre.lat - dLat);
  const north = Math.min(89.999, centre.lat + dLat);
  const squares = new Set<string>();
  // Sample on a half-square grid so no 2° x 1° square is skipped.
  for (let lat = Math.floor(south); lat <= north + 1e-9; lat += 0.5) {
    const la = Math.min(lat < south ? south : lat, north);
    for (
      let lon = Math.floor((centre.lon - dLon) / 2) * 2;
      lon <= centre.lon + dLon + 1e-9;
      lon += 1
    ) {
      let lo = lon < centre.lon - dLon ? centre.lon - dLon : lon;
      lo = Math.min(lo, centre.lon + dLon);
      squares.add(fieldSquare(la, lo));
    }
  }
  return [...squares];
}

function fieldSquare(lat: number, lon: number): string {
  const longitude = (((lon + 180) % 360) + 360) % 360;
  const latitude = Math.max(0, Math.min(179.9999, lat + 90));
  return (
    String.fromCharCode(65 + Math.floor(longitude / 20)) +
    String.fromCharCode(65 + Math.floor(latitude / 10)) +
    String(Math.floor((longitude % 20) / 2)) +
    String(Math.floor(latitude % 10))
  );
}

/** Parse a "lat,lon" pair (URL params). Returns null for missing, non-numeric or out-of-range values. */
export function parseLatLon(
  lat: string | null | undefined,
  lon: string | null | undefined,
): GeoPoint | null {
  if (lat == null || lon == null || lat.trim() === '' || lon.trim() === '') return null;
  const la = Number(lat);
  const lo = Number(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { lat: la, lon: lo };
}

/** Round a coordinate for URL params (about 1 m at 5 decimals). */
export function formatCoordParam(value: number): string {
  return String(Math.round(value * 1e5) / 1e5);
}

/** Conventional Maidenhead casing: field upper-case, subsquare letters lower-case ("IO75ui23"). */
export function formatLocatorDisplay(locator: string): string {
  const s = locator.trim().replace(/\s/g, '');
  return (
    s.slice(0, 2).toUpperCase() +
    s.slice(2, 4) +
    s.slice(4, 6).toLowerCase() +
    s.slice(6, 8) +
    s.slice(8).toLowerCase()
  );
}

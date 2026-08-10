/** Mean Earth radius for globe altitude scaling — matches `footprint.ts` approximation. */
export const GLOBE_EARTH_RADIUS_KM = 6371;

/**
 * Convert km above the WGS84 ellipsoid to `react-globe.gl` altitude units (multiples of globe
 * radius above the surface: `0` = ground, `1` = one Earth radius above the surface).
 */
export function altitudeKmToGlobeRadiusUnits(altitudeKm: number): number {
  if (!Number.isFinite(altitudeKm) || altitudeKm <= 0) return 0;
  return altitudeKm / GLOBE_EARTH_RADIUS_KM;
}

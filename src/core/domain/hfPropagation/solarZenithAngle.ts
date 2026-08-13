const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const OBLIQUITY_DEG = 23.45;
const DAYS_PER_YEAR = 365;
/** Day-of-year when declination is ~0° (March equinox in the Cooper 1969 approximation). */
const EQUINOX_DAY_OF_YEAR = 81;

function utcDayOfYear(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  return (
    (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - startOfYear) /
      86_400_000 +
    1
  );
}

function utcHours(date: Date): number {
  return (
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600 +
    date.getUTCMilliseconds() / 3_600_000
  );
}

function normalizeLonDeg(lonDeg: number): number {
  let lon = lonDeg;
  while (lon <= -180) lon += 360;
  while (lon > 180) lon -= 360;
  return lon;
}

export interface SolarGeometry {
  declinationRad: number;
  /** Geographic latitude where the sun is overhead (equals declination, degrees). */
  subsolarLatDeg: number;
  /** Geographic longitude where the sun is overhead (degrees, −180…180]. */
  subsolarLonDeg: number;
}

/**
 * Cooper-1969 declination plus hour-angle subsolar longitude — shared by zenith angle,
 * the terminator ring, and the subsolar-point helper. Idealised, not a full ephemeris.
 */
export function solarGeometryAt(atMs: number): SolarGeometry {
  const date = new Date(atMs);
  const doy = utcDayOfYear(date);
  const declinationRad =
    OBLIQUITY_DEG *
    DEG_TO_RAD *
    Math.sin((360 / DAYS_PER_YEAR) * (doy - EQUINOX_DAY_OF_YEAR) * DEG_TO_RAD);
  const subsolarLonDeg = normalizeLonDeg(-15 * (utcHours(date) - 12));
  return {
    declinationRad,
    subsolarLatDeg: declinationRad * RAD_TO_DEG,
    subsolarLonDeg,
  };
}

/**
 * Solar zenith angle (degrees) at a given lat/lon and instant — standard formula from solar
 * declination + hour angle. 0° = sun directly overhead, 90° = sun at horizon, >90° = sun below
 * horizon (night). Pure function, no DOM/Worker dependency, matching this module's siblings.
 *
 * Idealised approximation (declination from day-of-year, hour angle from UTC + longitude) — not
 * a full-precision solar ephemeris. Accurate enough to gate D/F1 day-only activation for any
 * real date/time/location an operator picks.
 */
export function solarZenithAngleDeg(latDeg: number, lonDeg: number, atMs: number): number {
  const { declinationRad, subsolarLonDeg } = solarGeometryAt(atMs);
  const hourAngleRad = (lonDeg - subsolarLonDeg) * DEG_TO_RAD;
  const latRad = latDeg * DEG_TO_RAD;
  const cosZenith =
    Math.sin(latRad) * Math.sin(declinationRad) +
    Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);
  const clamped = Math.min(1, Math.max(-1, cosZenith));
  return Math.acos(clamped) * RAD_TO_DEG;
}

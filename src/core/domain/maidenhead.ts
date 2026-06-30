import type { GeoPoint } from '../models/libraryTypes.ts';

/**
 * Maidenhead locator ↔ WGS84 coordinate conversion. Vendor-neutral amateur
 * radio domain helper (no CPS / format concerns).
 */

export type LocatorPrecision = 4 | 6 | 8;

function normalise(locator: string): string {
  return locator.trim().toUpperCase().replace(/\s/g, '');
}

export function isValidLocator(locator: string): boolean {
  return /^[A-R]{2}[0-9]{2}([A-X]{2}([0-9]{2})?)?$/.test(normalise(locator));
}

export function locatorToCoords(locator: string): GeoPoint | null {
  const s = normalise(locator);
  if (!isValidLocator(s)) return null;

  let lon = (s.charCodeAt(0) - 65) * 20;
  let lat = (s.charCodeAt(1) - 65) * 10;

  lon += Number.parseInt(s[2], 10) * 2;
  lat += Number.parseInt(s[3], 10);

  if (s.length >= 6) {
    lon += (s.charCodeAt(4) - 65 + 0.5) * (2 / 24);
    lat += (s.charCodeAt(5) - 65 + 0.5) * (1 / 24);
  } else {
    // Centre of the 4-char square.
    lon += 1;
    lat += 0.5;
  }

  if (s.length >= 8) {
    lon += (Number.parseInt(s[6], 10) + 0.5) * (2 / 240);
    lat += (Number.parseInt(s[7], 10) + 0.5) * (1 / 240);
  }

  return { lat: lat - 90, lon: lon - 180 };
}

export function coordsToLocator(lat: number, lon: number, precision: LocatorPrecision = 6): string {
  let latitude = Math.max(-90, Math.min(89.999999, lat)) + 90;
  let longitude = Math.max(-180, Math.min(179.999999, lon)) + 180;

  let result = '';
  result += String.fromCharCode(Math.floor(longitude / 20) + 65);
  result += String.fromCharCode(Math.floor(latitude / 10) + 65);

  longitude %= 20;
  latitude %= 10;
  result += String(Math.floor(longitude / 2));
  result += String(Math.floor(latitude / 1));

  if (precision < 6) return result;

  longitude %= 2;
  latitude %= 1;
  result += String.fromCharCode(Math.floor(longitude / (2 / 24)) + 65);
  result += String.fromCharCode(Math.floor(latitude / (1 / 24)) + 65);

  if (precision < 8) return result;

  longitude %= 2 / 24;
  latitude %= 1 / 24;
  result += String(Math.floor(longitude / (2 / 240)));
  result += String(Math.floor(latitude / (1 / 240)));

  return result;
}

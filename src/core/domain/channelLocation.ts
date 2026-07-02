import type { Channel } from '../models/library.ts';
import type { GeoPoint } from '../models/libraryTypes.ts';
import {
  coordsToLocator,
  isValidLocator,
  locatorToCoords,
  type LocatorPrecision,
} from './maidenhead.ts';

export type LocationEditSource = 'locator' | 'coords';

export interface ChannelLocationInput {
  maidenheadLocator: string | null;
  location: GeoPoint | null;
  useLocation: boolean;
  lastEdited: LocationEditSource;
}

export interface ReconciledChannelLocation {
  maidenheadLocator: string | null;
  location: GeoPoint | null;
  useLocation: boolean;
}

/** Normalise locator text — uppercase, trimmed; null when empty or invalid. */
export function normaliseLocator(input: string | null | undefined): string | null {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  return isValidLocator(upper) ? upper : null;
}

function coordsRoughlyMatch(a: GeoPoint, b: GeoPoint, epsilon = 0.0001): boolean {
  return Math.abs(a.lat - b.lat) < epsilon && Math.abs(a.lon - b.lon) < epsilon;
}

/**
 * Reconcile locator and coordinates on save. When both were edited in one session,
 * coordinates win (matches export precedence for conflicting positions).
 */
export function reconcileChannelLocation(input: ChannelLocationInput): ReconciledChannelLocation {
  const { lastEdited, useLocation } = input;
  const locatorRaw = (input.maidenheadLocator ?? '').trim();
  const hasCoords =
    input.location != null &&
    Number.isFinite(input.location.lat) &&
    Number.isFinite(input.location.lon);

  if (!useLocation && !locatorRaw && !hasCoords) {
    return { maidenheadLocator: null, location: null, useLocation: false };
  }

  if (lastEdited === 'locator') {
    const locator = normaliseLocator(locatorRaw);
    if (locator) {
      const fromLocator = locatorToCoords(locator);
      return {
        maidenheadLocator: locator,
        location: fromLocator,
        useLocation: true,
      };
    }
    if (hasCoords && input.location) {
      return {
        maidenheadLocator: coordsToLocator(input.location.lat, input.location.lon, 6),
        location: input.location,
        useLocation,
      };
    }
    return { maidenheadLocator: null, location: null, useLocation: false };
  }

  // Coords (or map) edited last — coordinates win on conflict.
  if (hasCoords && input.location) {
    return {
      maidenheadLocator: coordsToLocator(input.location.lat, input.location.lon, 6),
      location: input.location,
      useLocation: useLocation || true,
    };
  }

  const locator = normaliseLocator(locatorRaw);
  if (locator) {
    return {
      maidenheadLocator: locator,
      location: locatorToCoords(locator),
      useLocation: useLocation || true,
    };
  }

  return { maidenheadLocator: null, location: null, useLocation: false };
}

/** Lat/lon for map picker — prefers stored coordinates over locator centre. */
export function coordsFromChannelLocation(
  channel: Pick<Channel, 'location' | 'maidenheadLocator'>,
): GeoPoint | null {
  if (channel.location != null) {
    return channel.location;
  }
  const locator = normaliseLocator(channel.maidenheadLocator);
  if (locator) {
    return locatorToCoords(locator);
  }
  return null;
}

/** Character length of a normalised locator (4, 6, 8, or 10); 0 when absent/invalid. */
export function locatorCharCount(locator: string | null | undefined): number {
  return normaliseLocator(locator)?.length ?? 0;
}

/** Decimal places in lat/lon — proxy for coordinate precision (higher = finer). */
export function coordinateDecimalPrecision(point: GeoPoint): number {
  const decimalPlaces = (value: number): number => {
    const trimmed = value.toFixed(8).replace(/\.?0+$/, '');
    const dot = trimmed.indexOf('.');
    return dot < 0 ? 0 : trimmed.length - dot - 1;
  };
  return Math.min(decimalPlaces(point.lat), decimalPlaces(point.lon));
}

/** True when WGS84 coordinates fall inside the grid square for `locator` at its precision. */
export function coordsWithinLocator(point: GeoPoint, locator: string | null | undefined): boolean {
  const norm = normaliseLocator(locator);
  if (!norm) return false;
  const len = norm.length;
  if (len !== 4 && len !== 6 && len !== 8 && len !== 10) return false;
  const derived = coordsToLocator(point.lat, point.lon, len as LocatorPrecision);
  return derived === norm;
}

/** True when the candidate locator is strictly less precise than the reference. */
export function isLocatorLessPrecise(
  reference: string | null | undefined,
  candidate: string | null | undefined,
): boolean {
  const refLen = locatorCharCount(reference);
  const candLen = locatorCharCount(candidate);
  if (refLen === 0 || candLen === 0) return false;
  return candLen < refLen;
}

/** True when candidate coordinates are rounded more coarsely than the reference. */
export function isCoordinateLessPrecise(
  reference: GeoPoint | null | undefined,
  candidate: GeoPoint | null | undefined,
): boolean {
  if (!reference || !candidate) return false;
  const refPrec = coordinateDecimalPrecision(reference);
  const candPrec = coordinateDecimalPrecision(candidate);
  if (refPrec === 0 || candPrec === 0) return false;
  return candPrec < refPrec;
}

/** Whether locator-derived coords differ materially from stored coordinates. */
export function locationConflict(
  location: GeoPoint | null,
  maidenheadLocator: string | null,
): boolean {
  if (!location || !maidenheadLocator) return false;
  const locator = normaliseLocator(maidenheadLocator);
  if (!locator) return false;
  const fromLocator = locatorToCoords(locator);
  if (!fromLocator) return false;
  return !coordsRoughlyMatch(location, fromLocator);
}

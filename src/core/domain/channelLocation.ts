import type { Channel } from '../models/library.ts';
import type { GeoPoint } from '../models/libraryTypes.ts';
import { coordsToLocator, isValidLocator, locatorToCoords } from './maidenhead.ts';

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

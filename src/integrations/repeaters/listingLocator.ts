import { coordsToLocator } from '@core/domain/maidenhead.ts';
import type { RepeaterListing } from './types.ts';

/** 4-char Maidenhead for directory display and prefix filters; falls back to coords when wire has none. */
export function listingDisplayLocator(listing: RepeaterListing): string | null {
  if (listing.locator?.trim()) {
    return listing.locator.trim().toUpperCase();
  }
  if (listing.location != null) {
    return coordsToLocator(listing.location.lat, listing.location.lon, 4);
  }
  return null;
}

export function listingMatchesLocatorPrefix(listing: RepeaterListing, prefix: string): boolean {
  const normalised = prefix.trim().toUpperCase().replace(/\s/g, '');
  if (!normalised) {
    return true;
  }
  const locator = listingDisplayLocator(listing);
  return locator?.toUpperCase().startsWith(normalised) ?? false;
}

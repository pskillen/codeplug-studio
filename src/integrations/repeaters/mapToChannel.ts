import { toTitleCase } from '@core/domain/titleCase.ts';
import { newChannel } from '@core/domain/factories.ts';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import { normaliseLocator } from '@core/domain/channelLocation.ts';
import type { Channel } from '@core/models/library.ts';
import { buildModeProfilesFromListing } from './buildModeProfiles.ts';
import type { RepeaterListing } from './types.ts';

export interface MapListingOptions {
  /** Title-case town/status text (ETCC returns upper case). Default false. */
  titleCaseText?: boolean;
  /** Leave comment empty (BrandMeister). Default false. */
  omitComment?: boolean;
}

function formatListingText(value: string | undefined, titleCaseText: boolean): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return titleCaseText ? toTitleCase(trimmed) : trimmed;
}

function buildComment(
  listing: RepeaterListing,
  options: MapListingOptions,
): string {
  if (options.omitComment) return '';
  const name = formatListingText(listing.name, options.titleCaseText ?? false);
  const status = formatListingText(listing.status, options.titleCaseText ?? false);
  return [name, status].filter((s) => s.length > 0).join(' — ');
}

function defaultMapOptions(listing: RepeaterListing, options: MapListingOptions = {}): MapListingOptions {
  return {
    titleCaseText: options.titleCaseText ?? false,
    omitComment: options.omitComment ?? listing.source === 'brandmeister',
  };
}

/**
 * Map a normalised repeater listing into a vendor-neutral library `Channel`.
 * Lives in integrations (it depends on the external listing shape) but produces
 * only core model fields — no wire strings leak into the library.
 */
export function repeaterListingToChannel(
  listing: RepeaterListing,
  projectId: string,
  options: MapListingOptions = {},
): Channel {
  const opts = defaultMapOptions(listing, options);
  const rawName = listing.name || listing.callsign || 'Repeater';
  const name = formatListingText(rawName, opts.titleCaseText ?? false) || rawName;
  const base = newChannel(projectId, name);

  const locatorFromListing = listing.locator ? normaliseLocator(listing.locator) : null;
  const locatorFromCoords =
    listing.location != null
      ? coordsToLocator(listing.location.lat, listing.location.lon, 6)
      : null;

  return {
    ...base,
    name,
    callsign: listing.callsign,
    rxFrequency: listing.rxFrequencyHz,
    txFrequency: listing.txFrequencyHz,
    location: listing.location,
    useLocation: listing.location !== null,
    maidenheadLocator: locatorFromListing ?? locatorFromCoords,
    comment: buildComment(listing, opts),
    modeProfiles: buildModeProfilesFromListing(listing),
  };
}

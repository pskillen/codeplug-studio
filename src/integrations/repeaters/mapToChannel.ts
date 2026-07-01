import { newChannel } from '@core/domain/factories.ts';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import { normaliseLocator } from '@core/domain/channelLocation.ts';
import type { Channel } from '@core/models/library.ts';
import { buildModeProfilesFromListing } from './buildModeProfiles.ts';
import type { RepeaterListing } from './types.ts';

/**
 * Map a normalised repeater listing into a vendor-neutral library `Channel`.
 * Lives in integrations (it depends on the external listing shape) but produces
 * only core model fields — no wire strings leak into the library.
 */
export function repeaterListingToChannel(listing: RepeaterListing, projectId: string): Channel {
  const name = listing.name || listing.callsign || 'Repeater';
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
    comment: [listing.name, listing.status].filter((s) => s.length > 0).join(' — '),
    modeProfiles: buildModeProfilesFromListing(listing),
  };
}

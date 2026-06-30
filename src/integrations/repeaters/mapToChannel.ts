import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import { buildModeProfilesFromListing } from './buildModeProfiles.ts';
import type { RepeaterListing } from './types.ts';

/**
 * Map a normalised repeater listing into a vendor-neutral library `Channel`.
 * Lives in integrations (it depends on the external listing shape) but produces
 * only core model fields — no wire strings leak into the library.
 */
export function repeaterListingToChannel(listing: RepeaterListing, projectId: string): Channel {
  const base = newChannel(projectId, listing.callsign || listing.name || 'Repeater');

  const name =
    listing.callsign && listing.name
      ? `${listing.callsign} ${listing.name}`
      : listing.callsign || listing.name || base.name;

  return {
    ...base,
    name,
    callsign: listing.callsign,
    rxFrequency: listing.rxFrequencyHz,
    txFrequency: listing.txFrequencyHz,
    location: listing.location,
    useLocation: listing.location !== null,
    comment: [listing.name, listing.status].filter((s) => s.length > 0).join(' — '),
    modeProfiles: buildModeProfilesFromListing(listing),
  };
}

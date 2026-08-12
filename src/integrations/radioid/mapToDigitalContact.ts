import type { DigitalContact } from '@core/models/library.ts';
import { newDigitalContact } from '@core/domain/factories.ts';
import { radioidListingDisplayName } from './contactDiff.ts';
import type { RadioidDmrUserListing } from './types.ts';

/** Map a RadioID.net DMR user row to a new library `DigitalContact`. */
export function mapRadioidUserToDigitalContact(
  listing: RadioidDmrUserListing,
  projectId: string,
): DigitalContact {
  const name = radioidListingDisplayName(listing);
  return {
    ...newDigitalContact(projectId, name, listing.id, 'dmr'),
    callsign: listing.callsign.trim(),
    city: listing.city.trim(),
    state: listing.state.trim(),
    country: listing.country.trim(),
  };
}

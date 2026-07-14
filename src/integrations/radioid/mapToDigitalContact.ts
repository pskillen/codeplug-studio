import type { DigitalContact } from '@core/models/library.ts';
import { newDigitalContact } from '@core/domain/factories.ts';
import type { RadioidDmrUserListing } from './types.ts';

function displayNameFromListing(listing: RadioidDmrUserListing): string {
  const full = [listing.fname, listing.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (listing.name?.trim()) return listing.name.trim();
  return listing.callsign.trim() || 'Untitled contact';
}

/** Map a RadioID.net DMR user row to a new library `DigitalContact`. */
export function mapRadioidUserToDigitalContact(
  listing: RadioidDmrUserListing,
  projectId: string,
): DigitalContact {
  const name = displayNameFromListing(listing);
  return {
    ...newDigitalContact(projectId, name, listing.id, 'dmr'),
    callsign: listing.callsign.trim(),
    city: listing.city.trim(),
    state: listing.state.trim(),
    country: listing.country.trim(),
  };
}

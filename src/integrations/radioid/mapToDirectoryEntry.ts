import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { radioidListingDisplayName } from './contactDiff.ts';
import type { RadioidDmrUserListing } from './types.ts';

const DIRECTORY_METADATA_FIELDS = [
  'name',
  'callsign',
  'city',
  'state',
  'country',
] as const satisfies readonly (keyof Pick<
  DigitalIdDirectoryEntry,
  'name' | 'callsign' | 'city' | 'state' | 'country'
>)[];

/** Map a RadioID.net DMR user row to a directory shadow entry. */
export function mapRadioidUserToDirectoryEntry(
  listing: RadioidDmrUserListing,
  projectId: string,
): DigitalIdDirectoryEntry {
  return {
    projectId,
    digitalId: listing.id,
    mode: 'dmr',
    name: radioidListingDisplayName(listing),
    callsign: listing.callsign.trim(),
    city: listing.city.trim(),
    state: listing.state.trim(),
    country: listing.country.trim(),
    fetchedAt: new Date().toISOString(),
  };
}

/** Apply RadioID.net fields that differ from the directory row. Returns null when unchanged. */
export function applyRadioidListingToDirectoryEntry(
  existing: DigitalIdDirectoryEntry,
  listing: RadioidDmrUserListing,
): DigitalIdDirectoryEntry | null {
  const fresh = mapRadioidUserToDirectoryEntry(listing, existing.projectId);
  const changed = DIRECTORY_METADATA_FIELDS.some((field) => existing[field] !== fresh[field]);
  if (!changed) return null;
  return { ...fresh, remarks: existing.remarks };
}

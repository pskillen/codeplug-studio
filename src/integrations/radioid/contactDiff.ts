import type { DigitalContact } from '@core/models/library.ts';
import type { RadioidDmrUserListing } from './types.ts';

export function radioidListingDisplayName(listing: RadioidDmrUserListing): string {
  const full = [listing.fname, listing.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (listing.name?.trim()) return listing.name.trim();
  return listing.callsign.trim() || 'Untitled contact';
}

export type DigitalContactDiffField = 'name' | 'callsign' | 'city' | 'state' | 'country';

export interface DigitalContactDiffRow {
  field: DigitalContactDiffField;
  label: string;
  local: string;
  remote: string;
  changed: boolean;
  selectByDefault: boolean;
}

const FIELD_LABELS: Record<DigitalContactDiffField, string> = {
  name: 'Name',
  callsign: 'Callsign',
  city: 'City',
  state: 'State / province',
  country: 'Country',
};

function remoteValues(listing: RadioidDmrUserListing): Record<DigitalContactDiffField, string> {
  return {
    name: radioidListingDisplayName(listing),
    callsign: listing.callsign.trim(),
    city: listing.city.trim(),
    state: listing.state.trim(),
    country: listing.country.trim(),
  };
}

function localValues(contact: DigitalContact): Record<DigitalContactDiffField, string> {
  return {
    name: contact.name,
    callsign: contact.callsign,
    city: contact.city,
    state: contact.state,
    country: contact.country,
  };
}

export function diffDigitalContactFromListing(
  contact: DigitalContact,
  listing: RadioidDmrUserListing,
): DigitalContactDiffRow[] {
  const local = localValues(contact);
  const remote = remoteValues(listing);
  const fields: DigitalContactDiffField[] = ['name', 'callsign', 'city', 'state', 'country'];

  return fields.map((field) => {
    const changed = local[field] !== remote[field];
    return {
      field,
      label: FIELD_LABELS[field],
      local: local[field] || '—',
      remote: remote[field] || '—',
      changed,
      selectByDefault: changed,
    };
  });
}

export function diffHasChanges(rows: DigitalContactDiffRow[]): boolean {
  return rows.some((row) => row.changed);
}

export function buildDigitalContactPatchFromDiff(
  contact: DigitalContact,
  listing: RadioidDmrUserListing,
  fields: readonly DigitalContactDiffField[],
): DigitalContact {
  const remote = remoteValues(listing);
  const patch = { ...contact };
  for (const field of fields) {
    patch[field] = remote[field];
  }
  return patch;
}

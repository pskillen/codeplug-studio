import type { DigitalContact } from '@core/models/library.ts';
import {
  DEFAULT_RADIOID_CONTACT_NAME_MODE,
  radioidListingImportName,
  type RadioidContactNameMode,
} from './contactName.ts';
import type { RadioidDmrUserListing } from './types.ts';

/** @deprecated Use radioidListingImportName with an explicit mode. */
export function radioidListingDisplayName(
  listing: RadioidDmrUserListing,
  mode: RadioidContactNameMode = DEFAULT_RADIOID_CONTACT_NAME_MODE,
): string {
  return radioidListingImportName(listing, mode);
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

function remoteValues(
  listing: RadioidDmrUserListing,
  nameMode: RadioidContactNameMode,
): Record<DigitalContactDiffField, string> {
  return {
    name: radioidListingImportName(listing, nameMode),
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
  nameMode: RadioidContactNameMode = DEFAULT_RADIOID_CONTACT_NAME_MODE,
): DigitalContactDiffRow[] {
  const local = localValues(contact);
  const remote = remoteValues(listing, nameMode);
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
  nameMode: RadioidContactNameMode = DEFAULT_RADIOID_CONTACT_NAME_MODE,
): DigitalContact {
  const remote = remoteValues(listing, nameMode);
  const patch = { ...contact };
  for (const field of fields) {
    patch[field] = remote[field];
  }
  return patch;
}

/** Apply all RadioID.net fields that differ from the library contact. Returns null when unchanged. */
export function applyRadioidListingUpdates(
  contact: DigitalContact,
  listing: RadioidDmrUserListing,
  nameMode: RadioidContactNameMode = DEFAULT_RADIOID_CONTACT_NAME_MODE,
): DigitalContact | null {
  const rows = diffDigitalContactFromListing(contact, listing, nameMode);
  const fields = rows.filter((row) => row.changed).map((row) => row.field);
  if (fields.length === 0) return null;
  return buildDigitalContactPatchFromDiff(contact, listing, fields, nameMode);
}

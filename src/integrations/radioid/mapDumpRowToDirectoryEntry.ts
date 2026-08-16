import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { radioidListingDisplayName } from './contactDiff.ts';
import type { RadioidDmrUserListing } from './types.ts';

/** Normalised dump column names (header row, uppercased). */
export type RadioidDumpColumn =
  'RADIO_ID' | 'CALLSIGN' | 'FIRST_NAME' | 'LAST_NAME' | 'CITY' | 'STATE' | 'COUNTRY' | 'REMARKS';

export function normaliseRadioidDumpHeader(header: string): string {
  return header.trim().toUpperCase().replace(/\s+/g, '_');
}

/** Build a header-name → column index map from the dump's first row. */
export function buildRadioidDumpHeaderIndex(headers: readonly string[]): Map<string, number> {
  const index = new Map<string, number>();
  headers.forEach((header, columnIndex) => {
    const key = normaliseRadioidDumpHeader(header);
    if (key) index.set(key, columnIndex);
  });
  return index;
}

function fieldAt(
  fields: readonly string[],
  headerIndex: Map<string, number>,
  column: RadioidDumpColumn,
): string {
  const idx = headerIndex.get(column);
  if (idx === undefined) return '';
  return (fields[idx] ?? '').trim();
}

/** Map one user.csv data row to a directory shadow entry. Returns null when ID is invalid. */
export function mapRadioidDumpRowToDirectoryEntry(
  fields: readonly string[],
  headerIndex: Map<string, number>,
  projectId: string,
  fetchedAt: string,
): DigitalIdDirectoryEntry | null {
  const idRaw = fieldAt(fields, headerIndex, 'RADIO_ID');
  const digitalId = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(digitalId) || digitalId <= 0) return null;

  const listing: RadioidDmrUserListing = {
    id: digitalId,
    callsign: fieldAt(fields, headerIndex, 'CALLSIGN'),
    fname: fieldAt(fields, headerIndex, 'FIRST_NAME'),
    surname: fieldAt(fields, headerIndex, 'LAST_NAME'),
    name: '',
    city: fieldAt(fields, headerIndex, 'CITY'),
    state: fieldAt(fields, headerIndex, 'STATE'),
    country: fieldAt(fields, headerIndex, 'COUNTRY'),
  };

  const remarks = fieldAt(fields, headerIndex, 'REMARKS');

  return {
    projectId,
    digitalId,
    mode: 'dmr',
    name: radioidListingDisplayName(listing),
    callsign: listing.callsign,
    city: listing.city,
    state: listing.state,
    country: listing.country,
    ...(remarks ? { remarks } : {}),
    fetchedAt,
  };
}

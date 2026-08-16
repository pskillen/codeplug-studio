import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';

/** IndexedDB-only fields for case-insensitive / prefix directory queries. */
export type DigitalIdDirectoryIdbRow = DigitalIdDirectoryEntry & {
  callsignLower: string;
  nameLower: string;
  digitalIdStr: string;
};

export function toDirectoryIdbRow(entry: DigitalIdDirectoryEntry): DigitalIdDirectoryIdbRow {
  return {
    ...entry,
    callsignLower: entry.callsign.toLocaleLowerCase('en'),
    nameLower: entry.name.toLocaleLowerCase('en'),
    digitalIdStr: String(entry.digitalId),
  };
}

export function stripDirectoryIdbRow(row: DigitalIdDirectoryIdbRow): DigitalIdDirectoryEntry {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip IDB-only index fields
  const { callsignLower, nameLower, digitalIdStr, ...entry } = row;
  return entry;
}

export function stripDirectoryIdbRowIfNeeded(
  row: DigitalIdDirectoryEntry | DigitalIdDirectoryIdbRow,
): DigitalIdDirectoryEntry {
  if ('callsignLower' in row && 'nameLower' in row && 'digitalIdStr' in row) {
    return stripDirectoryIdbRow(row as DigitalIdDirectoryIdbRow);
  }
  return row;
}

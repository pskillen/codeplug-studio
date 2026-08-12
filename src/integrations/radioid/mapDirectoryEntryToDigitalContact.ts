import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { DigitalContact } from '@core/models/library.ts';
import { newDigitalContact } from '@core/domain/factories.ts';

/** Map a directory shadow row to a new library `DigitalContact` (new UUID). */
export function mapDirectoryEntryToDigitalContact(entry: DigitalIdDirectoryEntry): DigitalContact {
  return {
    ...newDigitalContact(entry.projectId, entry.name, entry.digitalId, entry.mode),
    callsign: entry.callsign,
    city: entry.city,
    state: entry.state,
    country: entry.country,
    remarks: entry.remarks ?? '',
  };
}

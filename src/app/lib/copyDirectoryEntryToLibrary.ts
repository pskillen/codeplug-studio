import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { DigitalContact } from '@core/models/library.ts';
import { findDigitalContactByDigitalId } from '@integrations/radioid/index.ts';
import { mapDirectoryEntryToDigitalContact } from '@integrations/radioid/mapDirectoryEntryToDigitalContact.ts';

export type CopyDirectoryDuplicateResult = {
  kind: 'duplicate';
  existingContactId: string;
};

export type CopyDirectorySuccessResult = {
  kind: 'success';
  contact: DigitalContact;
};

export type CopyDirectoryResult = CopyDirectoryDuplicateResult | CopyDirectorySuccessResult;

/** Map a directory row to a library contact, blocking when `digitalId` already exists. */
export function prepareCopyDirectoryEntryToLibrary(
  entry: DigitalIdDirectoryEntry,
  libraryContacts: DigitalContact[],
): CopyDirectoryResult {
  const existing = findDigitalContactByDigitalId(libraryContacts, entry.digitalId);
  if (existing) {
    return { kind: 'duplicate', existingContactId: existing.id };
  }
  return { kind: 'success', contact: mapDirectoryEntryToDigitalContact(entry) };
}

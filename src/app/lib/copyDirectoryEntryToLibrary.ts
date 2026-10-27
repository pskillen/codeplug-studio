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

export type AddDirectoryEntryResult =
  CopyDirectoryDuplicateResult | { kind: 'added'; contactId: string } | { kind: 'error' };

type PutDigitalContact = (
  row: DigitalContact,
  expectedRevision: number | null,
) => Promise<{ ok: boolean }>;

/**
 * Add a directory row to contacts: block on duplicate `digitalId`, otherwise persist a new
 * library contact. Shared by the ID directory table row action and the detail modal.
 */
export async function addDirectoryEntryToContacts(
  entry: DigitalIdDirectoryEntry,
  libraryContacts: DigitalContact[],
  putDigitalContact: PutDigitalContact,
): Promise<AddDirectoryEntryResult> {
  const prepared = prepareCopyDirectoryEntryToLibrary(entry, libraryContacts);
  if (prepared.kind === 'duplicate') return prepared;
  try {
    const result = await putDigitalContact(prepared.contact, null);
    if (!result.ok) return { kind: 'error' };
    return { kind: 'added', contactId: prepared.contact.id };
  } catch {
    return { kind: 'error' };
  }
}

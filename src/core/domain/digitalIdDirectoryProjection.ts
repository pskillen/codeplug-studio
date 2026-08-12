/** Dual-bank Write overlap and default toggles — vendor-neutral; no CPS wire shapes. */

export type DualBankWriteMode = 'codeplug' | 'digitalIdList';

export interface DualBankRadioWriteOptions {
  /** Library digital contacts (address book / private contacts). */
  includeLibraryContacts: boolean;
  /** Local RadioID directory shadow rows. */
  includeDigitalIdDirectory: boolean;
}

export function libraryDigitalIdSet(contacts: readonly { digitalId: number }[]): Set<number> {
  const ids = new Set<number>();
  for (const contact of contacts) {
    if (contact.digitalId > 0) ids.add(contact.digitalId);
  }
  return ids;
}

/** When both banks contribute, library digital contacts win on `digitalId`. */
export function shouldIncludeDirectoryRow(
  digitalId: number,
  libraryIds: ReadonlySet<number>,
): boolean {
  if (digitalId <= 0) return false;
  return !libraryIds.has(digitalId);
}

export function defaultDualBankWriteOptions(mode: DualBankWriteMode): DualBankRadioWriteOptions {
  return mode === 'codeplug'
    ? { includeLibraryContacts: true, includeDigitalIdDirectory: false }
    : { includeLibraryContacts: false, includeDigitalIdDirectory: true };
}

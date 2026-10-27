import type { BuildExportSettings } from '@core/models/radioBuild.ts';

/** Dual-bank Write overlap and projection options — vendor-neutral; no CPS wire shapes. */

export type DualBankWriteMode = 'codeplug' | 'digitalIdList';

export interface ProjectedDigitalContactRow {
  digitalId: number;
  wireName: string;
  callsign: string;
  city: string;
  province: string;
  country: string;
  remark: string;
}

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

/**
 * Overlap rule: skip directory rows whose `digitalId` is already a contact. Radios whose lookup
 * store may hold the same ID as a contact (OpenGD77 User Database) do not apply it.
 */
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

/**
 * Operator-facing Write radio popup source. `none` skips overlaying contact / directory banks.
 */
export type DigitalContactsWriteSource = 'none' | 'library' | 'directory' | 'both';

export function dualBankOptionsFromWriteSource(
  source: DigitalContactsWriteSource,
): DualBankRadioWriteOptions {
  return {
    includeLibraryContacts: source === 'library' || source === 'both',
    includeDigitalIdDirectory: source === 'directory' || source === 'both',
  };
}

export function writeSourceIncludesDirectory(source: DigitalContactsWriteSource): boolean {
  return source === 'directory' || source === 'both';
}

/**
 * CPS export ID-directory toggles for a build: the stored dual-bank choice, else the deprecated
 * pre-#1433 Anytone single-bank mode mapped once, else the codeplug default.
 */
export function cpsDualBankOptionsForBuild(
  settings: BuildExportSettings | undefined,
): DualBankRadioWriteOptions {
  if (settings?.cpsDualBankDirectory) return settings.cpsDualBankDirectory;
  switch (settings?.cpsSingleBankProjectionMode) {
    case 'contacts-only':
      return { includeLibraryContacts: true, includeDigitalIdDirectory: false };
    case 'directory-only':
      return { includeLibraryContacts: false, includeDigitalIdDirectory: true };
    case 'merge':
      return { includeLibraryContacts: true, includeDigitalIdDirectory: true };
    case 'skip':
      return { includeLibraryContacts: false, includeDigitalIdDirectory: false };
    default:
      return defaultDualBankWriteOptions('codeplug');
  }
}

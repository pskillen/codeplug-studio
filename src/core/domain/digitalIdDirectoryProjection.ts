import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
/** Dual-bank / single-bank Write overlap and projection modes — vendor-neutral; no CPS wire shapes. */

export type DualBankWriteMode = 'codeplug' | 'digitalIdList';

export type SingleBankWriteMode = 'codeplug' | 'digitalIdList';

/** Single shared contact bank (no `SeparateDigitalIdList` trait). */
export type SingleBankDigitalProjectionMode = 'contacts-only' | 'directory-only' | 'merge' | 'skip';

export interface ProjectedDigitalContactRow {
  digitalId: number;
  wireName: string;
  callsign: string;
  city: string;
  province: string;
  country: string;
  remark: string;
}

export interface ProjectSingleBankDigitalContactsArgs {
  mode: SingleBankDigitalProjectionMode;
  libraryContacts: readonly ProjectedDigitalContactRow[];
  directoryRows: readonly ProjectedDigitalContactRow[];
  maxContacts: number;
}

export function defaultSingleBankProjectionMode(
  mode: SingleBankWriteMode,
): SingleBankDigitalProjectionMode {
  return mode === 'codeplug' ? 'contacts-only' : 'directory-only';
}

export function singleBankProjectionModesForWrite(
  mode: SingleBankWriteMode,
): readonly SingleBankDigitalProjectionMode[] {
  return mode === 'codeplug'
    ? ['contacts-only', 'directory-only', 'merge', 'skip']
    : ['contacts-only', 'directory-only', 'merge'];
}

export function projectSingleBankDigitalContacts(args: ProjectSingleBankDigitalContactsArgs): {
  contacts: ProjectedDigitalContactRow[];
  warnings: ExportWarning[];
} {
  const warnings: ExportWarning[] = [];
  if (args.mode === 'skip') {
    return { contacts: [], warnings };
  }

  const out: ProjectedDigitalContactRow[] = [];
  const includeLibrary = args.mode === 'contacts-only' || args.mode === 'merge';
  const includeDirectory = args.mode === 'directory-only' || args.mode === 'merge';

  if (includeLibrary) {
    for (const row of args.libraryContacts) {
      if (out.length >= args.maxContacts) break;
      if (row.digitalId <= 0) continue;
      out.push(row);
    }
    if (args.libraryContacts.length > args.maxContacts) {
      pushGeneralWarning(
        warnings,
        `Build has ${args.libraryContacts.length} digital contact(s); only ${args.maxContacts} export to radio contact bank`,
      );
    }
  }

  if (includeDirectory) {
    const libraryIds = libraryDigitalIdSet(includeLibrary ? args.libraryContacts : []);
    let skippedOverlap = 0;
    let truncated = 0;
    for (const row of args.directoryRows) {
      if (!shouldIncludeDirectoryRow(row.digitalId, libraryIds)) {
        skippedOverlap++;
        continue;
      }
      if (out.length >= args.maxContacts) {
        truncated++;
        continue;
      }
      out.push(row);
    }
    if (skippedOverlap > 0) {
      pushGeneralWarning(
        warnings,
        `Skipped ${skippedOverlap} directory row(s) whose DMR ID already exists on a library digital contact`,
      );
    }
    if (truncated > 0) {
      pushGeneralWarning(
        warnings,
        `Directory has more contacts than the radio contact bank allows; only ${args.maxContacts} export from directory`,
      );
    }
  }

  return { contacts: out, warnings };
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
 * Single shared contact bank: skip directory rows whose `digitalId` is already
 * on a library contact. Dual-bank radios that keep a separate lookup store
 * (OpenGD77 User Database) must **not** use this — both stores may hold the same ID.
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

export function singleBankProjectionFromWriteSource(
  source: DigitalContactsWriteSource,
): SingleBankDigitalProjectionMode {
  switch (source) {
    case 'none':
      return 'skip';
    case 'library':
      return 'contacts-only';
    case 'directory':
      return 'directory-only';
    case 'both':
      return 'merge';
  }
}

export function writeSourceIncludesDirectory(source: DigitalContactsWriteSource): boolean {
  return source === 'directory' || source === 'both';
}

/**
 * Stream directory shadow rows into radio Write DTOs (dual-bank trait radios).
 */

import {
  libraryDigitalIdSet,
  shouldIncludeDirectoryRow,
  type DualBankRadioWriteOptions,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import {
  isAtD890RadioIoProfileId,
  isDm32RadioIoProfileId,
} from '@core/import-export/formatProfiles.ts';
import type { DualBankWriteMode } from '@core/domain/digitalIdDirectoryProjection.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import { mapDirectoryEntryToRadioDigitalContactDto } from '@integrations/radioid/mapDirectoryEntryToRadioDto.ts';
import { DM32_RADIOFOUNDRY_PROFILE_ID } from '@integrations/radio-io/radios/dm32uv-radiofoundry/constants.ts';
import type {
  RadioDigitalContactDto,
  RadioRadioIdDto,
} from '@integrations/radio-io/radioWriteProjection.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';
import { isOpenGd77RadioIoEgress } from './radioIoChannelMap.ts';
import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import { digitalIdDatabaseCap } from '@core/import-export/profileExportLimits.ts';
import { pageDigitalIdDirectoryForWrite } from './directoryWritePaging.ts';

export interface DualBankRadioWritePrepareOptions {
  mode: DualBankWriteMode;
  options: DualBankRadioWriteOptions;
}

export interface DualBankDirectorySlice {
  radioIds: RadioRadioIdDto[];
  digitalContacts: RadioDigitalContactDto[];
}

export interface CollectDualBankDirectorySliceArgs {
  store: ProjectPersistence;
  projectId: string;
  library: LibrarySlice;
  /** CPS `formatId` or Web Serial `egressProfileId` — used to pick directory bank targets. */
  formatId?: string;
  egressProfileId: string;
  options: DualBankRadioWriteOptions;
  maxDirectoryContacts?: number;
  /**
   * DMR IDs that count as contacts for the overlap skip. Defaults to every library contact;
   * the AT-D890 passes the build's contacts.
   */
  libraryDigitalIds?: ReadonlySet<number>;
  warnings: ExportWarning[];
  onProgress?: ProgressFn;
}

function dualBankDirectoryTargets(
  formatId: string | undefined,
  egressProfileId: string,
): { forDm32: boolean; forOpenGd77: boolean; forAtD890: boolean; forRadioFoundry: boolean } {
  // RadioFoundry keeps library contacts in the codeplug table and the ID
  // directory in the DMR ID database. It is not the stock DM-32 address book.
  if (egressProfileId === DM32_RADIOFOUNDRY_PROFILE_ID) {
    return { forDm32: false, forOpenGd77: false, forAtD890: false, forRadioFoundry: true };
  }
  if (formatId === 'dm32' || isDm32RadioIoProfileId(egressProfileId)) {
    return { forDm32: true, forOpenGd77: false, forAtD890: false, forRadioFoundry: false };
  }
  if (formatId === 'opengd77' || isOpenGd77RadioIoEgress(egressProfileId)) {
    return { forDm32: false, forOpenGd77: true, forAtD890: false, forRadioFoundry: false };
  }
  if (formatId === 'anytone' || isAtD890RadioIoProfileId(egressProfileId)) {
    return { forDm32: false, forOpenGd77: false, forAtD890: true, forRadioFoundry: false };
  }
  return { forDm32: false, forOpenGd77: false, forAtD890: false, forRadioFoundry: false };
}

export async function collectDualBankDirectorySlice(
  args: CollectDualBankDirectorySliceArgs,
): Promise<DualBankDirectorySlice> {
  if (!args.options.includeDigitalIdDirectory) {
    return { radioIds: [], digitalContacts: [] };
  }

  const libraryIds = args.libraryDigitalIds ?? libraryDigitalIdSet(args.library.digitalContacts);
  const { forDm32, forOpenGd77, forAtD890, forRadioFoundry } = dualBankDirectoryTargets(
    args.formatId,
    args.egressProfileId,
  );
  if (!forDm32 && !forOpenGd77 && !forAtD890 && !forRadioFoundry) {
    return { radioIds: [], digitalContacts: [] };
  }

  const digitalContacts: RadioDigitalContactDto[] = [];
  let skippedOverlap = 0;
  const cap =
    args.maxDirectoryContacts ?? digitalIdDatabaseCap('radio-io', args.egressProfileId) ?? 0;
  // DM-32 shared 0x0F bank: skip library IDs only when Both (library is also written).
  // AT-D890 ID database: always skip build contacts, so the radio (which names callers from
  // the ID database first) shows the contact's own name.
  const skipOverlap = forDm32 ? args.options.includeLibraryContacts : forAtD890;

  const isOverlap = (row: DigitalIdDirectoryEntry): boolean =>
    skipOverlap && !shouldIncludeDirectoryRow(row.digitalId, libraryIds);
  const acceptRow = (row: DigitalIdDirectoryEntry): boolean => !isOverlap(row) && row.digitalId > 0;

  const { total, collected } = await pageDigitalIdDirectoryForWrite({
    store: args.store,
    projectId: args.projectId,
    cap,
    onProgress: args.onProgress,
    progressMsg: 'Loading directory contacts',
    acceptRow,
    onAcceptedRow: (row) => {
      digitalContacts.push(mapDirectoryEntryToRadioDigitalContactDto(row));
    },
    onRejectedRow: (row) => {
      if (isOverlap(row)) skippedOverlap++;
    },
  });

  if (skippedOverlap > 0) {
    pushGeneralWarning(
      args.warnings,
      `Skipped ${skippedOverlap} directory row(s) whose DMR ID already exists on a library digital contact`,
    );
  }
  if (collected >= cap && total > cap) {
    if (forOpenGd77) {
      pushGeneralWarning(
        args.warnings,
        `Directory has ${total} contacts and the OpenGD77 User Database holds ${cap}; only ${cap} write from directory`,
      );
    } else if (forAtD890) {
      pushGeneralWarning(
        args.warnings,
        `Directory has more contacts than the AT-D890 ID database allows; only ${cap} write from directory`,
      );
    } else if (forRadioFoundry) {
      pushGeneralWarning(
        args.warnings,
        `Directory has more contacts than the RadioFoundry DMR ID database allows; only ${cap} write from directory`,
      );
    } else {
      pushGeneralWarning(
        args.warnings,
        `Directory has more contacts than the DM-32 address book allows; only ${cap} write from directory`,
      );
    }
  }

  return { radioIds: [], digitalContacts };
}

/**
 * Stream directory shadow rows into radio Write DTOs (dual-bank trait radios).
 */

import {
  libraryDigitalIdSet,
  shouldIncludeDirectoryRow,
  type DualBankRadioWriteOptions,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import {
  isAtD890RadioIoProfileId,
  isDm32RadioIoProfileId,
} from '@core/import-export/formatProfiles.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { DualBankWriteMode } from '@core/domain/digitalIdDirectoryProjection.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import { mapDirectoryEntryToRadioDigitalContactDto } from '@integrations/radioid/mapDirectoryEntryToRadioDto.ts';
import type {
  RadioDigitalContactDto,
  RadioRadioIdDto,
} from '@integrations/radio-io/radioWriteProjection.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';
import { isOpenGd77RadioIoEgress } from './radioIoChannelMap.ts';
import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
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
  maxRadioIds?: number;
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
): { forDm32: boolean; forOpenGd77: boolean; forAtD890: boolean } {
  if (formatId === 'dm32' || isDm32RadioIoProfileId(egressProfileId)) {
    return { forDm32: true, forOpenGd77: false, forAtD890: false };
  }
  if (formatId === 'opengd77' || isOpenGd77RadioIoEgress(egressProfileId)) {
    return { forDm32: false, forOpenGd77: true, forAtD890: false };
  }
  if (formatId === 'anytone' || isAtD890RadioIoProfileId(egressProfileId)) {
    return { forDm32: false, forOpenGd77: false, forAtD890: true };
  }
  return { forDm32: false, forOpenGd77: false, forAtD890: false };
}

export async function collectDualBankDirectorySlice(
  args: CollectDualBankDirectorySliceArgs,
): Promise<DualBankDirectorySlice> {
  if (!args.options.includeDigitalIdDirectory) {
    return { radioIds: [], digitalContacts: [] };
  }

  const libraryIds = args.libraryDigitalIds ?? libraryDigitalIdSet(args.library.digitalContacts);
  const { forDm32, forOpenGd77, forAtD890 } = dualBankDirectoryTargets(
    args.formatId,
    args.egressProfileId,
  );
  if (!forDm32 && !forOpenGd77 && !forAtD890) {
    return { radioIds: [], digitalContacts: [] };
  }

  const digitalContacts: RadioDigitalContactDto[] = [];
  let skippedOverlap = 0;
  const openGd77Cap = args.maxDirectoryContacts ?? OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX;
  const dm32Cap = args.maxDirectoryContacts ?? DM32UV_LIMITS.ADDRESS_BOOK_WRITE_MAX;
  const atD890Cap = args.maxDirectoryContacts ?? AT_D890UV_LIMITS.DIGITAL_CONTACTS_MAX;
  const cap = forOpenGd77 ? openGd77Cap : forAtD890 ? atD890Cap : dm32Cap;
  // DM-32 shared 0x0F bank: skip library IDs only when Both (library is also written).
  // AT-D890 ID database: always skip build contacts, so the radio (which names callers from
  // the ID database first) shows the contact's own name.
  const skipOverlap = forDm32 ? args.options.includeLibraryContacts : forAtD890;

  const acceptRow = (row: DigitalIdDirectoryEntry): boolean => {
    if (skipOverlap && !shouldIncludeDirectoryRow(row.digitalId, libraryIds)) {
      skippedOverlap++;
      return false;
    }
    if (row.digitalId <= 0) return false;
    return true;
  };

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
        `Directory has more contacts than the OpenGD77 User Database allows; only ${openGd77Cap} write from directory`,
      );
    } else if (forAtD890) {
      pushGeneralWarning(
        args.warnings,
        `Directory has more contacts than the AT-D890 ID database allows; only ${atD890Cap} write from directory`,
      );
    } else {
      pushGeneralWarning(
        args.warnings,
        `Directory has more contacts than the DM-32 address book allows; only ${dm32Cap} write from directory`,
      );
    }
  }

  return { radioIds: [], digitalContacts };
}

/**
 * Stream directory shadow rows into radio Write DTOs (dual-bank trait radios).
 */

import {
  libraryDigitalIdSet,
  shouldIncludeDirectoryRow,
  type DualBankRadioWriteOptions,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
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
  warnings: ExportWarning[];
  onProgress?: ProgressFn;
}

function dualBankDirectoryTargets(
  formatId: string | undefined,
  egressProfileId: string,
): { forDm32: boolean; forOpenGd77: boolean } {
  if (formatId === 'dm32' || egressProfileId === 'radio-io-dm32uv') {
    return { forDm32: true, forOpenGd77: false };
  }
  if (formatId === 'opengd77' || isOpenGd77RadioIoEgress(egressProfileId)) {
    return { forDm32: false, forOpenGd77: true };
  }
  return { forDm32: false, forOpenGd77: false };
}

export async function collectDualBankDirectorySlice(
  args: CollectDualBankDirectorySliceArgs,
): Promise<DualBankDirectorySlice> {
  if (!args.options.includeDigitalIdDirectory) {
    return { radioIds: [], digitalContacts: [] };
  }

  const libraryIds = libraryDigitalIdSet(args.library.digitalContacts);
  const { forDm32, forOpenGd77 } = dualBankDirectoryTargets(args.formatId, args.egressProfileId);
  if (!forDm32 && !forOpenGd77) {
    return { radioIds: [], digitalContacts: [] };
  }

  const digitalContacts: RadioDigitalContactDto[] = [];
  let skippedOverlap = 0;
  const openGd77Cap = args.maxDirectoryContacts ?? OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX;
  const dm32Cap = args.maxDirectoryContacts ?? DM32UV_LIMITS.ADDRESS_BOOK_WRITE_MAX;
  const cap = forOpenGd77 ? openGd77Cap : dm32Cap;
  // Shared 0x0F bank: skip library IDs only when Both (library is also written).
  const skipDm32Overlap = forDm32 && args.options.includeLibraryContacts;

  const acceptRow = (row: DigitalIdDirectoryEntry): boolean => {
    if (skipDm32Overlap && !shouldIncludeDirectoryRow(row.digitalId, libraryIds)) {
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
    } else {
      pushGeneralWarning(
        args.warnings,
        `Directory has more contacts than the DM-32 address book allows; only ${dm32Cap} write from directory`,
      );
    }
  }

  return { radioIds: [], digitalContacts };
}

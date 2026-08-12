/**
 * Stream directory shadow rows into radio Write DTOs (dual-bank trait radios).
 */

import {
  libraryDigitalIdSet,
  shouldIncludeDirectoryRow,
  type DualBankRadioWriteOptions,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import type { DualBankWriteMode } from '@core/domain/digitalIdDirectoryProjection.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import {
  mapDirectoryEntryToRadioDigitalContactDto,
  mapDirectoryEntryToRadioRadioIdDto,
} from '@integrations/radioid/mapDirectoryEntryToRadioDto.ts';
import type {
  RadioDigitalContactDto,
  RadioRadioIdDto,
} from '@integrations/radio-io/radioWriteProjection.ts';
import { isOpenGd77RadioIoEgress } from './radioIoChannelMap.ts';

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
  warnings: string[];
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

  const radioIds: RadioRadioIdDto[] = [];
  const digitalContacts: RadioDigitalContactDto[] = [];
  let skippedOverlap = 0;
  let truncatedRadioIds = 0;
  let truncatedContacts = 0;

  await args.store.iterateDigitalIdDirectory(args.projectId, (row: DigitalIdDirectoryEntry) => {
    if (!shouldIncludeDirectoryRow(row.digitalId, libraryIds)) {
      skippedOverlap++;
      return;
    }
    if (forDm32) {
      if (args.maxRadioIds != null && radioIds.length >= args.maxRadioIds) {
        truncatedRadioIds++;
        return;
      }
      radioIds.push(mapDirectoryEntryToRadioRadioIdDto(row, radioIds.length));
    }
    if (forOpenGd77) {
      if (
        args.maxDirectoryContacts != null &&
        digitalContacts.length >= args.maxDirectoryContacts
      ) {
        truncatedContacts++;
        return;
      }
      digitalContacts.push(mapDirectoryEntryToRadioDigitalContactDto(row));
    }
  });

  if (skippedOverlap > 0) {
    args.warnings.push(
      `Skipped ${skippedOverlap} directory row(s) whose DMR ID already exists on a library digital contact`,
    );
  }
  if (truncatedRadioIds > 0 && args.maxRadioIds != null) {
    args.warnings.push(
      `Directory has more DMR IDs than the radio operator-ID bank allows; only ${args.maxRadioIds} export`,
    );
  }
  if (truncatedContacts > 0 && args.maxDirectoryContacts != null) {
    args.warnings.push(
      `Directory has more contacts than the radio contact bank allows; only ${args.maxDirectoryContacts} export from directory`,
    );
  }

  return { radioIds, digitalContacts };
}

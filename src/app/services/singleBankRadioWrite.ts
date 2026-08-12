/**
 * Stream directory shadow rows into single-bank digital contact Write DTOs (AT-D890).
 */

import {
  libraryDigitalIdSet,
  projectSingleBankDigitalContacts,
  shouldIncludeDirectoryRow,
  type ProjectedDigitalContactRow,
  type SingleBankDigitalProjectionMode,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import type { SingleBankWriteMode } from '@core/domain/digitalIdDirectoryProjection.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import { mapDirectoryEntryToRadioDigitalContactDto } from '@integrations/radioid/mapDirectoryEntryToRadioDto.ts';
import type { RadioDigitalContactDto } from '@integrations/radio-io/radioWriteProjection.ts';

export interface SingleBankRadioWritePrepareOptions {
  mode: SingleBankWriteMode;
  projectionMode: SingleBankDigitalProjectionMode;
}

export interface CollectSingleBankDigitalContactsArgs {
  store: ProjectPersistence;
  projectId: string;
  assembled: AssembledBuild;
  projectionMode: SingleBankDigitalProjectionMode;
  maxContacts: number;
  warnings: string[];
  mapLibraryRow: (row: AssembledBuild['digitalContacts'][number]) => ProjectedDigitalContactRow;
}

function dtoFromProjected(row: ProjectedDigitalContactRow): RadioDigitalContactDto {
  return {
    wireName: row.wireName,
    digitalId: row.digitalId,
    callsign: row.callsign,
    city: row.city,
    province: row.province,
    country: row.country,
    remark: row.remark,
  };
}

export async function collectSingleBankDigitalContacts(
  args: CollectSingleBankDigitalContactsArgs,
): Promise<RadioDigitalContactDto[] | undefined> {
  if (args.projectionMode === 'skip') {
    return undefined;
  }

  const libraryRows = args.assembled.digitalContacts.map(args.mapLibraryRow);
  const includeDirectory =
    args.projectionMode === 'directory-only' || args.projectionMode === 'merge';

  const directoryRows: ProjectedDigitalContactRow[] = [];
  if (includeDirectory) {
    const libraryIds = libraryDigitalIdSet(args.projectionMode === 'merge' ? libraryRows : []);
    const libraryUsed =
      args.projectionMode === 'merge'
        ? Math.min(libraryRows.filter((row) => row.digitalId > 0).length, args.maxContacts)
        : 0;
    const directoryCap = args.maxContacts - libraryUsed;
    let skippedOverlap = 0;
    let truncated = 0;
    await args.store.iterateDigitalIdDirectory(args.projectId, (row: DigitalIdDirectoryEntry) => {
      if (!shouldIncludeDirectoryRow(row.digitalId, libraryIds)) {
        skippedOverlap++;
        return;
      }
      if (directoryRows.length >= directoryCap) {
        truncated++;
        return;
      }
      const dto = mapDirectoryEntryToRadioDigitalContactDto(row);
      directoryRows.push({
        digitalId: dto.digitalId,
        wireName: dto.wireName,
        callsign: dto.callsign,
        city: dto.city,
        province: dto.province,
        country: dto.country,
        remark: dto.remark,
      });
    });
    if (skippedOverlap > 0) {
      args.warnings.push(
        `Skipped ${skippedOverlap} directory row(s) whose DMR ID already exists on a library digital contact`,
      );
    }
    if (truncated > 0) {
      args.warnings.push(
        `Directory has more contacts than the radio contact bank allows; only ${args.maxContacts} export from directory`,
      );
    }
  }

  const { contacts, warnings } = projectSingleBankDigitalContacts({
    mode: args.projectionMode,
    libraryContacts: libraryRows,
    directoryRows,
    maxContacts: args.maxContacts,
  });
  args.warnings.push(...warnings);
  return contacts.map(dtoFromProjected);
}

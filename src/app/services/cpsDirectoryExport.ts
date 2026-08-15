/**
 * Collect directory shadow rows for CPS file export — mirrors Web Serial Write overlap rules.
 */

import {
  defaultDualBankWriteOptions,
  defaultSingleBankProjectionMode,
  projectSingleBankDigitalContacts,
  shouldIncludeDirectoryRow,
  type DualBankRadioWriteOptions,
  type ProjectedDigitalContactRow,
  type SingleBankDigitalProjectionMode,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import {
  OPENGD77_CPS_DIRECTORY_WARNING,
  projectedRowToAssembledDigitalContact,
  type CpsDirectoryProjectionPayload,
} from '@core/domain/cpsDigitalDirectoryProjection.ts';
import type { CpsExportOptions, FormatId } from '@core/import-export/types.ts';
import { getProfileExportLimits } from '@core/import-export/profileExportLimits.ts';
import { BuildCapabilityTrait, traitProfileFor } from '@core/models/traits.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { AssembledBuild, LibrarySlice } from '@core/services/assemble.ts';
import { assemble } from '@core/services/assemble.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import { mapDirectoryEntryToRadioDigitalContactDto } from '@integrations/radioid/mapDirectoryEntryToRadioDto.ts';
import { collectDualBankDirectorySlice } from './dualBankRadioWrite.ts';

function hasSeparateDigitalIdList(profileId: string): boolean {
  return (
    traitProfileFor(profileId)?.traits.includes(BuildCapabilityTrait.SeparateDigitalIdList) ?? false
  );
}

function mapLibraryRowToProjected(
  row: AssembledBuild['digitalContacts'][number],
): ProjectedDigitalContactRow {
  return {
    digitalId: row.entity.digitalId,
    wireName: row.wireName,
    callsign: row.entity.callsign ?? '',
    city: row.entity.city ?? '',
    province: row.entity.state ?? '',
    country: row.entity.country ?? '',
    remark: row.entity.remarks ?? '',
  };
}

async function collectSingleBankCpsProjection(
  store: ProjectPersistence,
  projectId: string,
  assembled: AssembledBuild,
  mode: SingleBankDigitalProjectionMode,
  maxContacts: number,
  warnings: string[],
): Promise<CpsDirectoryProjectionPayload> {
  if (mode === 'skip') {
    return { omitDigitalContactList: true, warnings };
  }

  const libraryRows = assembled.digitalContacts.map(mapLibraryRowToProjected);
  const includeDirectory = mode === 'directory-only' || mode === 'merge';
  const directoryRows: ProjectedDigitalContactRow[] = [];

  if (includeDirectory) {
    const libraryIds = new Set(
      mode === 'merge'
        ? libraryRows.filter((row) => row.digitalId > 0).map((row) => row.digitalId)
        : [],
    );
    const libraryUsed =
      mode === 'merge'
        ? Math.min(libraryRows.filter((row) => row.digitalId > 0).length, maxContacts)
        : 0;
    const directoryCap = maxContacts - libraryUsed;
    let skippedOverlap = 0;
    let truncated = 0;

    await store.iterateDigitalIdDirectory(projectId, (row: DigitalIdDirectoryEntry) => {
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
      warnings.push(
        `Skipped ${skippedOverlap} directory row(s) whose DMR ID already exists on a library digital contact`,
      );
    }
    if (truncated > 0) {
      warnings.push(
        `Directory has more contacts than the radio contact bank allows; only ${maxContacts} export from directory`,
      );
    }
  }

  const { contacts, warnings: projectionWarnings } = projectSingleBankDigitalContacts({
    mode,
    libraryContacts: libraryRows,
    directoryRows,
    maxContacts,
  });
  warnings.push(...projectionWarnings);

  return {
    singleBankDigitalContacts: contacts.map((row) =>
      projectedRowToAssembledDigitalContact(row, projectId),
    ),
    warnings,
  };
}

async function collectDualBankCpsProjection(
  store: ProjectPersistence,
  projectId: string,
  library: LibrarySlice,
  egress: EgressPath,
  options: DualBankRadioWriteOptions,
  warnings: string[],
): Promise<CpsDirectoryProjectionPayload> {
  if (egress.formatId === 'opengd77') {
    if (options.includeDigitalIdDirectory) {
      warnings.push(OPENGD77_CPS_DIRECTORY_WARNING);
    }
    return {
      dualBank: {
        includeLibraryContacts: options.includeLibraryContacts,
        directoryDigitalContacts: [],
        dm32RadioIds: [],
        includeDm32RadioIdFile: false,
      },
      warnings,
    };
  }

  const limits = getProfileExportLimits(egress.formatId as FormatId, egress.profileId);
  const maxRadioIds = typeof limits?.maxRadioIds === 'number' ? limits.maxRadioIds : undefined;

  const slice = await collectDualBankDirectorySlice({
    store,
    projectId,
    library,
    formatId: egress.formatId,
    egressProfileId: egress.profileId,
    options,
    maxRadioIds,
    warnings,
  });

  const directoryDigitalContacts = slice.digitalContacts.map((dto) =>
    projectedRowToAssembledDigitalContact(
      {
        digitalId: dto.digitalId,
        wireName: dto.wireName,
        callsign: dto.callsign,
        city: dto.city,
        province: dto.province,
        country: dto.country,
        remark: dto.remark,
      },
      projectId,
    ),
  );

  const dm32RadioIds = slice.radioIds.map((entry) => ({
    dmrId: entry.dmrId,
    name: entry.name,
  }));

  return {
    dualBank: {
      includeLibraryContacts: options.includeLibraryContacts,
      directoryDigitalContacts,
      dm32RadioIds,
      includeDm32RadioIdFile:
        egress.formatId === 'dm32' &&
        (options.includeDigitalIdDirectory || dm32RadioIds.length > 0),
    },
    warnings,
  };
}

/** Stream directory rows and attach `directoryProjection` to CPS export options. */
export async function enrichCpsExportOptionsWithDirectory(
  store: ProjectPersistence,
  projectId: string,
  build: RadioBuild,
  egress: EgressPath,
  library: LibrarySlice,
  baseOptions: CpsExportOptions,
): Promise<CpsExportOptions> {
  const merged = mergeExportOptions(build, egress.formatId, {
    ...baseOptions,
    profileId: baseOptions.profileId ?? egress.profileId,
  });
  const warnings: string[] = [];
  let directoryProjection: CpsDirectoryProjectionPayload | undefined;

  if (hasSeparateDigitalIdList(egress.profileId)) {
    const dualOptions =
      merged.cpsDualBankDirectory ??
      build.exportSettings?.cpsDualBankDirectory ??
      defaultDualBankWriteOptions('codeplug');
    if (dualOptions.includeDigitalIdDirectory || !dualOptions.includeLibraryContacts) {
      directoryProjection = await collectDualBankCpsProjection(
        store,
        projectId,
        library,
        egress,
        dualOptions,
        warnings,
      );
    }
  } else if (egress.formatId === 'anytone') {
    const mode =
      merged.cpsSingleBankProjectionMode ??
      build.exportSettings?.cpsSingleBankProjectionMode ??
      defaultSingleBankProjectionMode('codeplug');
    const assembled = assemble(build, library, {
      formatId: egress.formatId,
      profileId: egress.profileId,
    });
    const limits = getProfileExportLimits('anytone', egress.profileId);
    const maxContacts = typeof limits?.maxContacts === 'number' ? limits.maxContacts : 10_000;
    directoryProjection = await collectSingleBankCpsProjection(
      store,
      projectId,
      assembled,
      mode,
      maxContacts,
      warnings,
    );
  }

  if (!directoryProjection) {
    return merged;
  }

  return {
    ...merged,
    directoryProjection: {
      ...directoryProjection,
      warnings: [...(directoryProjection.warnings ?? []), ...warnings],
    },
  };
}

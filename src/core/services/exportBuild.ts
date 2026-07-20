import type { FormatBuild } from '@core/models/formatBuild.ts';
import { findZoneGroupingSection } from '@core/domain/zoneGroupingLayout.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { getExportAdapter } from '@core/import-export/registry.ts';
import {
  isMultiFileExportAdapter,
  isSingleFileCpsExportAdapter,
} from '@core/import-export/exportAdapter.ts';
import { buildOpenGd77Zip } from '@core/import-export/formats/opengd77/packageZip.ts';
import { buildDm32Zip } from '@core/import-export/formats/dm32/packageZip.ts';
import { buildAnytoneZip } from '@core/import-export/formats/anytone/packageZip.ts';
import { buildNeonplugZip } from '@core/import-export/formats/neonplug/packageZip.ts';
import {
  anytoneLstFileName,
  isAnytoneLstFileName,
  serialiseAnytoneLstManifest,
} from '@core/import-export/formats/anytone/lstManifest.ts';
import { resolveEffectiveExportFileNames } from '@core/import-export/exportFileNames.ts';
import { dedupeWarnings } from '@core/import-export/dedupeWarnings.ts';
import type { CpsExportOptions, ExportResult, FormatId } from '@core/import-export/types.ts';
import {
  assemble,
  exportInclusionWarnings,
  type AssembledBuild,
  type LibrarySlice,
} from './assemble.ts';

export interface ExportBuildParams {
  build: FormatBuild;
  library: LibrarySlice;
  fileName: string;
  options?: CpsExportOptions;
}

export interface ExportBuildAllResult {
  assembled: AssembledBuild;
  files: Record<string, string>;
  warnings: string[];
}

export { mergeExportOptions };

function anytoneLstStem(options: CpsExportOptions): string | undefined {
  const stem = options.projectName?.trim();
  return stem || undefined;
}

function appendAnytoneLstManifest(
  formatId: FormatId,
  files: Record<string, string>,
  csvFileNames: readonly string[],
  options: CpsExportOptions,
): void {
  if (formatId !== 'anytone') return;
  const projectName = anytoneLstStem(options);
  if (!projectName) return;
  const lstName = anytoneLstFileName(projectName);
  files[lstName] = serialiseAnytoneLstManifest(csvFileNames);
}

function listCsvAndSidecarFileNames(
  formatId: FormatId,
  csvFileNames: readonly string[],
  options: CpsExportOptions,
): readonly string[] {
  if (formatId !== 'anytone' || !anytoneLstStem(options)) {
    return csvFileNames;
  }
  return [...csvFileNames, anytoneLstFileName(options.projectName!)];
}

/** Ordered CPS file names for a build without serialising file bodies. */
export function listExportBuildFileNames({
  build,
  library,
  options,
}: Omit<ExportBuildParams, 'fileName'>): readonly string[] {
  const exportOptions = mergeExportOptions(build, options, library);
  const projection = assemble(build, library, { profileId: exportOptions.profileId });
  const assembled = {
    ...projection,
    library,
    zoneGrouping: findZoneGroupingSection(build),
  };
  const csvFileNames = resolveEffectiveExportFileNames(
    build.formatId as FormatId,
    assembled,
    exportOptions,
  );
  return listCsvAndSidecarFileNames(build.formatId as FormatId, csvFileNames, exportOptions);
}

/** Serialise one CPS file from a build + library. */
export function exportBuildFile({
  build,
  library,
  fileName,
  options,
}: ExportBuildParams): ExportResult & { content: string; assembled: AssembledBuild } {
  const exportOptions = mergeExportOptions(build, options, library);
  const projection = assemble(build, library, { profileId: exportOptions.profileId });
  const assembled = {
    ...projection,
    library,
    zoneGrouping: findZoneGroupingSection(build),
  };
  const adapter = getExportAdapter(build.formatId as FormatId);
  if (!isMultiFileExportAdapter(adapter)) {
    throw new Error(`Format ${build.formatId} does not support multi-file CPS export`);
  }

  if (build.formatId === 'anytone' && isAnytoneLstFileName(fileName, exportOptions.projectName)) {
    const csvFileNames = resolveEffectiveExportFileNames(
      build.formatId as FormatId,
      assembled,
      exportOptions,
    );
    const content = serialiseAnytoneLstManifest(csvFileNames);
    return { content, warnings: [], assembled };
  }

  const result = adapter.serialiseFile(assembled, fileName, exportOptions);
  const warnings = dedupeWarnings([
    ...exportInclusionWarnings(build, library, assembled),
    ...adapter.collectExportWarnings(assembled, exportOptions),
    ...result.warnings,
  ]);
  return { ...result, warnings, assembled };
}

/** Serialise all CPS files for a build. */
export function exportBuildAll({
  build,
  library,
  options,
}: Omit<ExportBuildParams, 'fileName'>): ExportBuildAllResult {
  const exportOptions = mergeExportOptions(build, options, library);
  const projection = assemble(build, library, { profileId: exportOptions.profileId });
  const assembled = {
    ...projection,
    library,
    zoneGrouping: findZoneGroupingSection(build),
  };
  const adapter = getExportAdapter(build.formatId as FormatId);
  if (!isMultiFileExportAdapter(adapter)) {
    throw new Error(`Format ${build.formatId} does not support multi-file CPS export`);
  }

  const files: Record<string, string> = {};
  const warnings: string[] = [
    ...exportInclusionWarnings(build, library, assembled),
    ...adapter.collectExportWarnings(assembled, exportOptions),
  ];

  const exportFileNames = resolveEffectiveExportFileNames(
    build.formatId as FormatId,
    assembled,
    exportOptions,
  );

  for (const name of exportFileNames) {
    const result = adapter.serialiseFile(assembled, name, exportOptions);
    files[name] = result.content;
    warnings.push(...result.warnings);
  }

  appendAnytoneLstManifest(build.formatId as FormatId, files, exportFileNames, exportOptions);

  return { assembled, files, warnings: dedupeWarnings(warnings) };
}

/** Serialise a single CPS file (CHIRP memory CSV). */
export function exportBuildSingleFile({
  build,
  library,
  options,
}: Omit<ExportBuildParams, 'fileName'>): ExportBuildAllResult & {
  fileName: string;
  content: string;
} {
  const exportOptions = mergeExportOptions(build, options, library);
  const projection = assemble(build, library, { profileId: exportOptions.profileId });
  const assembled = {
    ...projection,
    library,
    zoneGrouping: findZoneGroupingSection(build),
  };
  const adapter = getExportAdapter(build.formatId as FormatId);
  if (!isSingleFileCpsExportAdapter(adapter)) {
    throw new Error(`Format ${build.formatId} does not support single-file CPS export`);
  }

  const fileName =
    options?.fileName ?? adapter.defaultFileName(exportOptions.profileId ?? build.profileId);
  const result = adapter.serialise(assembled, exportOptions);
  const warnings = dedupeWarnings([
    ...exportInclusionWarnings(build, library, assembled),
    ...result.warnings,
  ]);

  return {
    assembled,
    files: { [fileName]: result.content },
    warnings,
    fileName,
    content: result.content,
  };
}

/** Serialise all CPS files and package as a ZIP byte array. */
export function exportBuildZip({
  build,
  library,
  options,
}: Omit<ExportBuildParams, 'fileName'>): ExportBuildAllResult & { zip: Uint8Array } {
  const result = exportBuildAll({ build, library, options });
  const zip =
    build.formatId === 'neonplug'
      ? buildNeonplugZip(result.files)
      : build.formatId === 'dm32'
        ? buildDm32Zip(result.files)
        : build.formatId === 'anytone'
          ? buildAnytoneZip(result.files)
          : buildOpenGd77Zip(result.files);
  return { ...result, zip };
}

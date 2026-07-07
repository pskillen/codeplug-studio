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

/** Serialise one CPS file from a build + library. */
export function exportBuildFile({
  build,
  library,
  fileName,
  options,
}: ExportBuildParams): ExportResult & { content: string; assembled: AssembledBuild } {
  const exportOptions = mergeExportOptions(build, options);
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
  const result = adapter.serialiseFile(assembled, fileName, exportOptions);
  return { ...result, assembled };
}

/** Serialise all CPS files for a build. */
export function exportBuildAll({
  build,
  library,
  options,
}: Omit<ExportBuildParams, 'fileName'>): ExportBuildAllResult {
  const exportOptions = mergeExportOptions(build, options);
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
  const warnings: string[] = [...exportInclusionWarnings(build, library, assembled)];

  for (const name of adapter.fileNames) {
    const result = adapter.serialiseFile(assembled, name, exportOptions);
    files[name] = result.content;
    warnings.push(...result.warnings);
  }

  return { assembled, files, warnings };
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
  const exportOptions = mergeExportOptions(build, options);
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

  const fileName = options?.fileName ?? adapter.defaultFileName(exportOptions.profileId);
  const result = adapter.serialise(assembled, exportOptions);
  const warnings = [...exportInclusionWarnings(build, library, assembled), ...result.warnings];

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
    build.formatId === 'dm32' ? buildDm32Zip(result.files) : buildOpenGd77Zip(result.files);
  return { ...result, zip };
}

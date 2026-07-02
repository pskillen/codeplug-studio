import type { FormatBuild } from '@core/models/formatBuild.ts';
import { getExportAdapter } from '@core/import-export/registry.ts';
import { isMultiFileExportAdapter } from '@core/import-export/exportAdapter.ts';
import { buildOpenGd77Zip } from '@core/import-export/formats/opengd77/packageZip.ts';
import type { CpsExportOptions, ExportResult, FormatId } from '@core/import-export/types.ts';
import { assemble, exportInclusionWarnings, type AssembledBuild, type LibrarySlice } from './assemble.ts';

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

function mergeExportOptions(build: FormatBuild, options?: CpsExportOptions): CpsExportOptions {
  return {
    ...options,
    profileId: options?.profileId ?? build.profileId,
  };
}

/** Serialise one CPS file from a build + library. */
export function exportBuildFile({
  build,
  library,
  fileName,
  options,
}: ExportBuildParams): ExportResult & { content: string; assembled: AssembledBuild } {
  const exportOptions = mergeExportOptions(build, options);
  const assembled = assemble(build, library, { profileId: exportOptions.profileId });
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
  const assembled = assemble(build, library, { profileId: exportOptions.profileId });
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

/** Serialise all CPS files and package as a ZIP byte array. */
export function exportBuildZip({
  build,
  library,
  options,
}: Omit<ExportBuildParams, 'fileName'>): ExportBuildAllResult & { zip: Uint8Array } {
  const result = exportBuildAll({ build, library, options });
  return { ...result, zip: buildOpenGd77Zip(result.files) };
}

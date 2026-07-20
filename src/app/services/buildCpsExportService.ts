import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { CpsExportOptions, FormatId } from '@core/import-export/types.ts';
import { isSingleFileCpsExportAdapter } from '@core/import-export/exportAdapter.ts';
import { getExportAdapter } from '@core/import-export/registry.ts';
import {
  exportBuildAll,
  exportBuildFile,
  exportBuildSingleFile,
  exportBuildZip,
  listExportBuildFileNames,
} from '@core/services/exportBuild.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import { downloadTextFile, downloadZip } from '@integrations/download/browserDownload.ts';
import { googleDrivePort } from '@integrations/cloud/index.ts';
import { persistence } from '../state/persistence.ts';
import { loadLibrarySlice } from '../lib/loadLibrarySlice.ts';

export interface CpsDriveUploadTarget {
  folderId: string;
  fileName: string;
  existingFileId?: string;
}

export interface CpsDownloadResult {
  warnings: string[];
}

export interface CpsPreviewResult {
  files: Record<string, string>;
  warnings: string[];
  fileNames: string[];
}

async function requireBuild(
  store: ProjectPersistence,
  projectId: string,
  buildId: string,
): Promise<FormatBuild> {
  const build = await store.getFormatBuild(projectId, buildId);
  if (!build) {
    throw new Error(`Format build not found: ${buildId}`);
  }
  return build;
}

async function mergeProjectExportOptions(
  store: ProjectPersistence,
  projectId: string,
  options?: CpsExportOptions,
): Promise<CpsExportOptions> {
  const meta = await store.loadProjectMeta(projectId);
  if (!meta?.name?.trim()) {
    return options ?? {};
  }
  return { ...options, projectName: meta.name };
}

function slugifyFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '') || 'export'
  );
}

/** Default archive name for a build CPS export (`.zip`, or `.neonplug` for NeonPlug). */
export function defaultCpsZipFileName(buildName: string, formatId: FormatId): string {
  const ext = formatId === 'neonplug' ? 'neonplug' : 'zip';
  return `${slugifyFileName(buildName)}-${formatId}.${ext}`;
}

/** Default single-file CPS name from the format adapter profile. */
export function defaultCpsSingleFileName(formatId: FormatId, profileId: string): string {
  const adapter = getExportAdapter(formatId);
  if (isSingleFileCpsExportAdapter(adapter)) {
    return adapter.defaultFileName(profileId);
  }
  return `${slugifyFileName(profileId)}.csv`;
}

/** Serialise all CPS CSV files for preview (no browser download). */
export async function previewCpsExport(
  projectId: string,
  buildId: string,
  options?: CpsExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsPreviewResult> {
  const build = await requireBuild(store, projectId, buildId);
  const library = await loadLibrarySlice(store, projectId);
  const exportOptions = await mergeProjectExportOptions(store, projectId, options);
  const result = exportBuildAll({ build, library, options: exportOptions });
  return {
    files: result.files,
    warnings: result.warnings,
    fileNames: [...listExportBuildFileNames({ build, library, options: exportOptions })],
  };
}

/** Ordered CPS file names for a build (static + conditional) without serialising bodies. */
export async function listCpsExportFileNames(
  projectId: string,
  buildId: string,
  options?: CpsExportOptions,
  store: ProjectPersistence = persistence,
): Promise<readonly string[]> {
  const build = await requireBuild(store, projectId, buildId);
  const library = await loadLibrarySlice(store, projectId);
  const exportOptions = await mergeProjectExportOptions(store, projectId, options);
  return listExportBuildFileNames({ build, library, options: exportOptions });
}

/** Serialise a single CPS CSV for preview (no browser download). */
export async function previewCpsSingleFile(
  projectId: string,
  buildId: string,
  options?: CpsExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsPreviewResult> {
  const build = await requireBuild(store, projectId, buildId);
  const library = await loadLibrarySlice(store, projectId);
  const result = exportBuildSingleFile({ build, library, options });
  const fileName = options?.fileName ?? result.fileName;
  return {
    files: result.files,
    warnings: result.warnings,
    fileNames: [fileName],
  };
}

/** Download one CPS CSV file for a build. */
export async function downloadCpsFile(
  projectId: string,
  buildId: string,
  fileName: string,
  options?: CpsExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsDownloadResult> {
  const build = await requireBuild(store, projectId, buildId);
  const library = await loadLibrarySlice(store, projectId);
  const exportOptions = await mergeProjectExportOptions(store, projectId, options);
  const result = exportBuildFile({ build, library, fileName, options: exportOptions });
  downloadTextFile(result.content, fileName);
  return { warnings: result.warnings };
}

/** Download a single CPS CSV file for a build (CHIRP memory export). */
export async function downloadCpsSingleFile(
  projectId: string,
  buildId: string,
  options?: CpsExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsDownloadResult> {
  const build = await requireBuild(store, projectId, buildId);
  const library = await loadLibrarySlice(store, projectId);
  const result = exportBuildSingleFile({ build, library, options });
  const fileName = options?.fileName ?? result.fileName;
  downloadTextFile(result.content, fileName);
  return { warnings: result.warnings };
}

export type CpsZipExportOptions = CpsExportOptions & {
  /** Donor radio-read `.neonplug` for merge-into-base NeonPlug export. */
  baseNeonplugBytes?: Uint8Array;
};

export {
  extractNeonplugDonorFromZip,
  isNeonplugDonorBag,
  summariseNeonplugDonorRetain,
  validateNeonplugDonorBase,
  type NeonplugDonorBag,
  type NeonplugDonorRetainSummary,
} from '@core/services/exportBuild.ts';

/** Download all CPS CSV files for a build as a ZIP archive. */
export async function downloadCpsZip(
  projectId: string,
  buildId: string,
  options?: CpsZipExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsDownloadResult> {
  const build = await requireBuild(store, projectId, buildId);
  const library = await loadLibrarySlice(store, projectId);
  const { baseNeonplugBytes, ...cpsOptions } = options ?? {};
  const exportOptions = await mergeProjectExportOptions(store, projectId, cpsOptions);
  const result = exportBuildZip({
    build,
    library,
    options: exportOptions,
    baseNeonplugBytes,
  });
  const zipName =
    options?.fileName ?? defaultCpsZipFileName(build.name, build.formatId as FormatId);
  downloadZip(result.zip, zipName);
  return { warnings: result.warnings };
}

/** Build CPS ZIP bytes without triggering a browser download. */
export async function buildCpsZipBytes(
  projectId: string,
  buildId: string,
  options?: CpsZipExportOptions,
  store: ProjectPersistence = persistence,
): Promise<{ zip: Uint8Array; fileName: string; warnings: string[] }> {
  const build = await requireBuild(store, projectId, buildId);
  const library = await loadLibrarySlice(store, projectId);
  const { baseNeonplugBytes, ...cpsOptions } = options ?? {};
  const exportOptions = await mergeProjectExportOptions(store, projectId, cpsOptions);
  const result = exportBuildZip({
    build,
    library,
    options: exportOptions,
    baseNeonplugBytes,
  });
  const fileName =
    options?.fileName ?? defaultCpsZipFileName(build.name, build.formatId as FormatId);
  return { zip: result.zip, fileName, warnings: result.warnings };
}

/** Upload a CPS ZIP archive for a build to Google Drive. */
export async function uploadCpsZipToDrive(
  projectId: string,
  buildId: string,
  target: CpsDriveUploadTarget,
  options?: CpsZipExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsDownloadResult> {
  const { zip, warnings } = await buildCpsZipBytes(
    projectId,
    buildId,
    { ...options, fileName: target.fileName },
    store,
  );
  await googleDrivePort.writeBinaryFile({
    parentId: target.folderId,
    fileName: target.fileName,
    content: zip,
    mimeType: 'application/zip',
    fileId: target.existingFileId,
  });
  return { warnings };
}

import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
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

/** App export options — optional egress id defaults to the build's preferred pathway (#654). */
export type CpsAppExportOptions = CpsExportOptions & {
  egressId?: string;
};

async function requireBuildAndEgress(
  store: ProjectPersistence,
  projectId: string,
  buildId: string,
  egressId?: string,
): Promise<{ build: RadioBuild; egress: EgressPath }> {
  const build = await store.getRadioBuild(projectId, buildId);
  if (!build) {
    throw new Error(`Radio build not found: ${buildId}`);
  }
  const paths = await store.listEgressPathsForBuild(projectId, buildId);
  const egress =
    (egressId ? paths.find((path) => path.id === egressId) : undefined) ??
    paths.find((path) => path.id === build.defaultEgressPathId) ??
    paths[0];
  if (!egress) {
    throw new Error(`No egress path for radio build ${buildId}`);
  }
  return { build, egress };
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

function stripAppOptions(options?: CpsAppExportOptions): {
  egressId?: string;
  cpsOptions: CpsExportOptions;
} {
  if (!options) return { cpsOptions: {} };
  const { egressId, ...cpsOptions } = options;
  return { egressId, cpsOptions };
}

/** Serialise all CPS CSV files for preview (no browser download). */
export async function previewCpsExport(
  projectId: string,
  buildId: string,
  options?: CpsAppExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsPreviewResult> {
  const { egressId, cpsOptions } = stripAppOptions(options);
  const { build, egress } = await requireBuildAndEgress(store, projectId, buildId, egressId);
  const library = await loadLibrarySlice(store, projectId);
  const exportOptions = await mergeProjectExportOptions(store, projectId, cpsOptions);
  const result = exportBuildAll({ build, egress, library, options: exportOptions });
  return {
    files: result.files,
    warnings: result.warnings,
    fileNames: [...listExportBuildFileNames({ build, egress, library, options: exportOptions })],
  };
}

/** Ordered CPS file names for a build (static + conditional) without serialising bodies. */
export async function listCpsExportFileNames(
  projectId: string,
  buildId: string,
  options?: CpsAppExportOptions,
  store: ProjectPersistence = persistence,
): Promise<readonly string[]> {
  const { egressId, cpsOptions } = stripAppOptions(options);
  const { build, egress } = await requireBuildAndEgress(store, projectId, buildId, egressId);
  const library = await loadLibrarySlice(store, projectId);
  const exportOptions = await mergeProjectExportOptions(store, projectId, cpsOptions);
  return listExportBuildFileNames({ build, egress, library, options: exportOptions });
}

/** Serialise a single CPS CSV for preview (no browser download). */
export async function previewCpsSingleFile(
  projectId: string,
  buildId: string,
  options?: CpsAppExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsPreviewResult> {
  const { egressId, cpsOptions } = stripAppOptions(options);
  const { build, egress } = await requireBuildAndEgress(store, projectId, buildId, egressId);
  const library = await loadLibrarySlice(store, projectId);
  const result = exportBuildSingleFile({ build, egress, library, options: cpsOptions });
  const fileName = cpsOptions.fileName ?? result.fileName;
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
  options?: CpsAppExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsDownloadResult> {
  const { egressId, cpsOptions } = stripAppOptions(options);
  const { build, egress } = await requireBuildAndEgress(store, projectId, buildId, egressId);
  const library = await loadLibrarySlice(store, projectId);
  const exportOptions = await mergeProjectExportOptions(store, projectId, cpsOptions);
  const result = exportBuildFile({ build, egress, library, fileName, options: exportOptions });
  downloadTextFile(result.content, fileName);
  return { warnings: result.warnings };
}

/** Download a single CPS CSV file for a build (CHIRP memory export). */
export async function downloadCpsSingleFile(
  projectId: string,
  buildId: string,
  options?: CpsAppExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsDownloadResult> {
  const { egressId, cpsOptions } = stripAppOptions(options);
  const { build, egress } = await requireBuildAndEgress(store, projectId, buildId, egressId);
  const library = await loadLibrarySlice(store, projectId);
  const result = exportBuildSingleFile({ build, egress, library, options: cpsOptions });
  const fileName = cpsOptions.fileName ?? result.fileName;
  downloadTextFile(result.content, fileName);
  return { warnings: result.warnings };
}

export type CpsZipExportOptions = CpsAppExportOptions & {
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
  const { zip, fileName, warnings } = await buildCpsZipBytes(projectId, buildId, options, store);
  downloadZip(zip, fileName);
  return { warnings };
}

/** Build CPS ZIP bytes without triggering a browser download. */
export async function buildCpsZipBytes(
  projectId: string,
  buildId: string,
  options?: CpsZipExportOptions,
  store: ProjectPersistence = persistence,
): Promise<{ zip: Uint8Array; fileName: string; warnings: string[] }> {
  const { egressId, baseNeonplugBytes, ...rest } = options ?? {};
  const cpsOptions: CpsExportOptions = rest;
  const { build, egress } = await requireBuildAndEgress(store, projectId, buildId, egressId);
  const library = await loadLibrarySlice(store, projectId);
  const exportOptions = await mergeProjectExportOptions(store, projectId, cpsOptions);
  const result = exportBuildZip({
    build,
    egress,
    library,
    options: exportOptions,
    baseNeonplugBytes,
  });
  const fileName =
    options?.fileName ?? defaultCpsZipFileName(build.name, egress.formatId as FormatId);
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

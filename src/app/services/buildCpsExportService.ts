import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { exportBuildFile, exportBuildZip } from '@core/services/exportBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import { downloadTextFile, downloadZip } from '@integrations/download/browserDownload.ts';
import { persistence } from '../state/persistence.ts';

export interface CpsDownloadResult {
  warnings: string[];
}

async function loadLibrarySlice(
  store: ProjectPersistence,
  projectId: string,
): Promise<LibrarySlice> {
  const [channels, zones, talkGroups, digitalContacts, analogContacts, rxGroupLists] =
    await Promise.all([
      store.listChannels(projectId),
      store.listZones(projectId),
      store.listTalkGroups(projectId),
      store.listDigitalContacts(projectId),
      store.listAnalogContacts(projectId),
      store.listRxGroupLists(projectId),
    ]);
  return { channels, zones, talkGroups, digitalContacts, analogContacts, rxGroupLists };
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

function slugifyFileName(name: string): string {
  return (
    name
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '') || 'export'
  );
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
  const result = exportBuildFile({ build, library, fileName, options });
  downloadTextFile(result.content, fileName);
  return { warnings: result.warnings };
}

/** Download all CPS CSV files for a build as a ZIP archive. */
export async function downloadCpsZip(
  projectId: string,
  buildId: string,
  options?: CpsExportOptions,
  store: ProjectPersistence = persistence,
): Promise<CpsDownloadResult> {
  const build = await requireBuild(store, projectId, buildId);
  const library = await loadLibrarySlice(store, projectId);
  const result = exportBuildZip({ build, library, options });
  const zipName = options?.fileName ?? `${slugifyFileName(build.name)}-opengd77.zip`;
  downloadZip(result.zip, zipName);
  return { warnings: result.warnings };
}

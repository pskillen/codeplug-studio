import type { ExportDestinationKind } from '@core/models/interchange.ts';
import { recordImportDestination } from '@core/services/interchangeMeta.ts';
import type { ProjectInterchangePort } from '@core/services/projectInterchangePort.ts';
import {
  exportProjectYaml,
  type ExportProjectYamlOptions,
  type ExportProjectYamlResult,
} from '@core/services/exportProjectYaml.ts';
import {
  importProjectYaml,
  type ImportProjectYamlMode,
  type ImportProjectYamlResult,
} from '@core/services/importProjectYaml.ts';
import type { ProjectPersistence, ProjectSeed } from '@integrations/persistence/index.ts';
import { persistence } from '../state/persistence.ts';

function asInterchangePort(store: ProjectPersistence): ProjectInterchangePort {
  return {
    seedProject: (seed) => store.seedProject(seed as ProjectSeed),
    replaceProject: (projectId, seed) => store.replaceProject(projectId, seed as ProjectSeed),
    loadProjectSeed: (projectId) => store.loadProjectSeed(projectId),
    putProjectMeta: (row, expectedRevision) => store.putProjectMeta(row, expectedRevision),
  };
}

const port = asInterchangePort(persistence);

export async function importProjectFromYaml(
  yamlText: string,
  mode: ImportProjectYamlMode,
): Promise<ImportProjectYamlResult> {
  return importProjectYaml(port, yamlText, mode);
}

export async function exportProjectToYaml(
  projectId: string,
  options?: ExportProjectYamlOptions,
): Promise<ExportProjectYamlResult> {
  return exportProjectYaml(port, projectId, options);
}

export interface RecordProjectImportDestinationInput {
  destination: ExportDestinationKind;
  fileName: string;
  folderId?: string;
  folderName?: string;
  fileId?: string;
  syncedAt?: string;
  remoteProjectId?: string;
}

export async function recordProjectImportDestination(
  projectId: string,
  details: RecordProjectImportDestinationInput,
): Promise<void> {
  const seed = await port.loadProjectSeed(projectId);
  if (!seed) {
    throw new Error(`Project not found: ${projectId}`);
  }
  const updatedMeta = recordImportDestination(
    seed.meta,
    details.destination,
    {
      fileName: details.fileName,
      folderId: details.folderId,
      folderName: details.folderName,
      fileId: details.fileId,
      remoteProjectId: details.remoteProjectId,
    },
    details.syncedAt,
  );
  await port.putProjectMeta(updatedMeta, seed.meta.revision);
}

/** Test hook — inject an in-memory port without touching IndexedDB. */
export function createProjectImportExportService(store: ProjectPersistence) {
  const testPort = asInterchangePort(store);
  return {
    importProjectFromYaml: (yamlText: string, mode: ImportProjectYamlMode) =>
      importProjectYaml(testPort, yamlText, mode),
    exportProjectToYaml: (projectId: string, options?: ExportProjectYamlOptions) =>
      exportProjectYaml(testPort, projectId, options),
  };
}

import type { GoogleDriveInterchange } from '@core/models/interchange.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { portableSyncedAt } from '@core/services/interchangeMeta.ts';
import { isRemotePortableNewer, type ProjectSyncDiff } from '@core/services/projectSyncSummary.ts';
import type { GoogleDrivePort } from '@integrations/cloud/googleDrive.ts';
import { persistence } from '../state/persistence.ts';
import { buildImportOverwriteDiff, parseYamlImportPreview } from './yamlImportResolverService.ts';

export interface DriveRemoteCheckNewer {
  newer: true;
  diff: ProjectSyncDiff;
  remoteYaml: string;
  remoteProjectId: string;
  idMismatch: boolean;
}

export interface DriveRemoteCheckUpToDate {
  newer: false;
}

export type DriveRemoteCheckOutcome = DriveRemoteCheckNewer | DriveRemoteCheckUpToDate;

export interface CheckDriveRemoteUpdatesParams {
  projectId: string;
  drive: GoogleDriveInterchange;
  activeProject: ProjectMeta;
  port: GoogleDrivePort;
  withDriveAuthRetry: <T>(operation: () => Promise<T>) => Promise<T>;
}

export async function checkDriveRemoteUpdates({
  projectId,
  drive,
  activeProject,
  port,
  withDriveAuthRetry,
}: CheckDriveRemoteUpdatesParams): Promise<DriveRemoteCheckOutcome> {
  const metadata = await withDriveAuthRetry(() => port.getFileMetadata(drive.fileId));
  const freshMeta = await persistence.loadProjectMeta(projectId);
  const localSyncedAt = freshMeta ? portableSyncedAt(freshMeta) : portableSyncedAt(activeProject);
  const remoteTime = metadata.modifiedTime;
  if (!isRemotePortableNewer(remoteTime, localSyncedAt)) {
    return { newer: false };
  }
  const content = await withDriveAuthRetry(() => port.readFile(drive.fileId));
  const preview = parseYamlImportPreview(content);
  const remoteSummary = {
    ...preview.remoteSummary,
    lastModifiedAt: remoteTime ?? preview.remoteSummary.portableSyncedAt,
  };
  const diff = await buildImportOverwriteDiff(projectId, remoteSummary);
  return {
    newer: true,
    diff,
    remoteYaml: content,
    remoteProjectId: preview.projectId,
    idMismatch: preview.projectId !== projectId,
  };
}

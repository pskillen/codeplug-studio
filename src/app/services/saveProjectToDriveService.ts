import type { GoogleDriveInterchange } from '@core/models/interchange.ts';
import type { DriveFileMetadata, GoogleDrivePort } from '@integrations/cloud/index.ts';
import {
  exportProjectToYaml,
  recordProjectImportDestination,
} from './projectImportExportService.ts';

export interface SaveProjectToDriveInput {
  projectId: string;
  drive: GoogleDriveInterchange;
  /** Skip pre-save conflict checks — caller already confirmed with the operator. */
  force?: boolean;
}

export type DrivePortableSyncTarget = Pick<
  GoogleDriveInterchange,
  'fileId' | 'fileName' | 'folderId' | 'folderName'
>;

/** Align local portable sync time with Drive's authoritative modifiedTime after upload. */
export async function recordDrivePortableSyncAfterWrite(
  port: GoogleDrivePort,
  projectId: string,
  drive: DrivePortableSyncTarget,
  writeResult?: Pick<DriveFileMetadata, 'modifiedTime'>,
): Promise<string> {
  let syncedAt = writeResult?.modifiedTime;
  if (!syncedAt) {
    const metadata = await port.getFileMetadata(drive.fileId);
    syncedAt = metadata.modifiedTime;
  }
  if (!syncedAt) {
    syncedAt = new Date().toISOString();
  }
  await recordProjectImportDestination(projectId, {
    destination: 'googleDrive',
    fileName: drive.fileName,
    folderId: drive.folderId,
    folderName: drive.folderName,
    fileId: drive.fileId,
    syncedAt,
  });
  return syncedAt;
}

export async function executeSaveProjectToDrive(
  port: GoogleDrivePort,
  input: SaveProjectToDriveInput,
): Promise<void> {
  const { projectId, drive } = input;
  const exportResult = await exportProjectToYaml(projectId, {
    fileName: drive.fileName,
    recordDestination: 'googleDrive',
    driveDestination: {
      folderId: drive.folderId,
      folderName: drive.folderName,
      fileId: drive.fileId,
    },
  });

  const writeResult = await port.writeFile({
    parentId: drive.folderId,
    fileName: drive.fileName,
    content: exportResult.content,
    fileId: drive.fileId,
  });
  await recordDrivePortableSyncAfterWrite(port, projectId, drive, writeResult);
}

/** @deprecated Use executeSaveProjectToDrive — kept for call sites migrating to conflict-aware flow. */
export async function saveProjectToDrive(
  port: GoogleDrivePort,
  input: SaveProjectToDriveInput,
): Promise<void> {
  return executeSaveProjectToDrive(port, input);
}

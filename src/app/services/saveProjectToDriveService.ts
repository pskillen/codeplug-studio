import type { GoogleDriveInterchange } from '@core/models/interchange.ts';
import type { GoogleDrivePort } from '@integrations/cloud/index.ts';
import { exportProjectToYaml } from './projectImportExportService.ts';

export interface SaveProjectToDriveInput {
  projectId: string;
  drive: GoogleDriveInterchange;
}

export async function saveProjectToDrive(
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

  await port.writeFile({
    parentId: drive.folderId,
    fileName: drive.fileName,
    content: exportResult.content,
    fileId: drive.fileId,
  });
}

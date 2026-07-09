import type { ExportDestinationKind, ProjectInterchange } from '@core/models/interchange.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { isoNow } from '@core/models/revision.ts';

export type {
  ExportDestinationKind,
  GoogleDriveInterchange,
  LocalFileInterchange,
  ProjectInterchange,
} from '@core/models/interchange.ts';

export interface SuggestedExportDestination {
  fileName: string;
}

export function defaultLocalExportFileName(projectName: string): string {
  const base = projectName.trim() || 'project';
  const sanitised = base
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${sanitised || 'project'}.yaml`;
}

export function suggestExportDestination(
  meta: ProjectMeta,
  destination: ExportDestinationKind,
): SuggestedExportDestination | null {
  if (destination === 'localFile') {
    const fileName = meta.interchange?.localFile?.fileName;
    return fileName ? { fileName } : null;
  }
  const drive = meta.interchange?.googleDrive;
  return drive?.fileName ? { fileName: drive.fileName } : null;
}

export function recordExportDestination(
  meta: ProjectMeta,
  destination: ExportDestinationKind,
  details: { fileName: string; folderId?: string; folderName?: string; fileId?: string },
  exportedAt: string = isoNow(),
): ProjectMeta {
  const interchange: ProjectInterchange = { ...meta.interchange };

  if (destination === 'localFile') {
    interchange.localFile = {
      fileName: details.fileName,
      exportedAt,
    };
  } else {
    if (!details.folderId || !details.fileId) {
      throw new Error('googleDrive export destination requires folderId and fileId');
    }
    interchange.googleDrive = {
      folderId: details.folderId,
      folderName: details.folderName,
      fileId: details.fileId,
      fileName: details.fileName,
      exportedAt,
    };
  }

  return { ...meta, interchange };
}

/** Records portable interchange destination after import (same shape as export). */
export function recordImportDestination(
  meta: ProjectMeta,
  destination: ExportDestinationKind,
  details: { fileName: string; folderId?: string; folderName?: string; fileId?: string },
  syncedAt: string = isoNow(),
): ProjectMeta {
  return recordExportDestination(meta, destination, details, syncedAt);
}

export function portableSyncedAt(meta: ProjectMeta): string | null {
  return (
    meta.interchange?.googleDrive?.exportedAt ?? meta.interchange?.localFile?.exportedAt ?? null
  );
}

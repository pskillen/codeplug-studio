/** Last local file export destination for a project. */
export interface LocalFileInterchange {
  fileName: string;
  exportedAt: string;
}

/** Last Google Drive export destination for a project. */
export interface GoogleDriveInterchange {
  folderId: string;
  folderName?: string;
  fileId: string;
  fileName: string;
  exportedAt: string;
}

/**
 * Per-destination export memory on {@link ProjectMeta}.
 * CPS format keys (opengd77, chirp, …) may be added in Phase 4+.
 */
export interface ProjectInterchange {
  localFile?: LocalFileInterchange;
  googleDrive?: GoogleDriveInterchange;
}

export type ExportDestinationKind = 'localFile' | 'googleDrive';

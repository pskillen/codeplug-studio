import type { DriveFolderCrumb, DriveListItem } from '@integrations/cloud/index.ts';
import {
  APP_ROOT_FOLDER_NAME,
  DRIVE_ROOT_FOLDER_ID,
  DriveScopeError,
  isDriveAuthError,
} from '@integrations/cloud/index.ts';

export interface ResolveInitialBrowseInput {
  interchangeFolderId?: string;
  lastFolderId?: string | null;
  lastFolderPath?: DriveFolderCrumb[];
  /** Resolved app-owned Drive folder id, or null if it hasn't resolved yet. */
  appRootFolderId: string | null;
}

export function resolveInitialBrowseState(input: ResolveInitialBrowseInput): {
  folderId: string;
  path: DriveFolderCrumb[];
} {
  // DRIVE_ROOT_FOLDER_ID is a last-resort fallback for the rare case where
  // resolveAppRootFolder hasn't completed yet — see driveErrorMessage handling
  // for how a resulting DriveScopeError surfaces to the operator.
  const rootId = input.appRootFolderId ?? DRIVE_ROOT_FOLDER_ID;
  const folderId = input.interchangeFolderId ?? input.lastFolderId ?? rootId;
  const path =
    input.lastFolderPath && input.lastFolderPath.length > 0
      ? input.lastFolderPath
      : [{ id: rootId, name: APP_ROOT_FOLDER_NAME }];
  return { folderId, path };
}

export function appendFolderToPath(
  path: DriveFolderCrumb[],
  folder: DriveFolderCrumb,
): DriveFolderCrumb[] {
  return [...path, folder];
}

export function pathUpToIndex(path: DriveFolderCrumb[], index: number): DriveFolderCrumb[] {
  return path.slice(0, index + 1);
}

export function findYamlFileByName(
  children: DriveListItem[],
  fileName: string,
): DriveListItem | undefined {
  const target = fileName.trim().toLowerCase();
  return children.find(
    (child) => child.kind === 'yaml' && child.name.trim().toLowerCase() === target,
  );
}

export function formatBrowsePathLabel(path: DriveFolderCrumb[]): string {
  if (path.length === 0) return APP_ROOT_FOLDER_NAME;
  return path.map((crumb) => crumb.name).join(' / ');
}

export function driveErrorMessage(err: unknown): string {
  if (isDriveAuthError(err)) {
    return 'Google Drive session expired. Reconnect to continue.';
  }
  if (err instanceof DriveScopeError) {
    return "This file or folder is no longer reachable with Studio's Drive permissions — save it again to recreate it in Studio's Drive folder.";
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

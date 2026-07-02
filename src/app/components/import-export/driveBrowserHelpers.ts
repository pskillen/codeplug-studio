import type { DriveFolderCrumb, DriveListItem } from '@integrations/cloud/index.ts';
import { DRIVE_ROOT_FOLDER_ID } from '@integrations/cloud/index.ts';

export interface ResolveInitialBrowseInput {
  interchangeFolderId?: string;
  lastFolderId?: string | null;
  lastFolderPath?: DriveFolderCrumb[];
}

export function resolveInitialBrowseState(input: ResolveInitialBrowseInput): {
  folderId: string;
  path: DriveFolderCrumb[];
} {
  const folderId = input.interchangeFolderId ?? input.lastFolderId ?? DRIVE_ROOT_FOLDER_ID;
  const path =
    input.lastFolderPath && input.lastFolderPath.length > 0
      ? input.lastFolderPath
      : [{ id: DRIVE_ROOT_FOLDER_ID, name: 'My Drive' }];
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

export function driveErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

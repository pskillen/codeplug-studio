/**
 * Google Drive OAuth session and browse-path preferences (browser localStorage).
 */

export const DRIVE_ACCESS_TOKEN_KEY = 'codeplug-studio:drive:accessToken';
export const DRIVE_TOKEN_EXPIRES_AT_KEY = 'codeplug-studio:drive:tokenExpiresAt';
export const DRIVE_LAST_ACCOUNT_KEY = 'codeplug-studio:drive:lastAccount';
export const DRIVE_LAST_FOLDER_ID_KEY = 'codeplug-studio:drive:lastFolderId';
export const DRIVE_LAST_FOLDER_PATH_KEY = 'codeplug-studio:drive:lastFolderPath';

export const DRIVE_STORAGE_KEYS = [
  DRIVE_ACCESS_TOKEN_KEY,
  DRIVE_TOKEN_EXPIRES_AT_KEY,
  DRIVE_LAST_ACCOUNT_KEY,
  DRIVE_LAST_FOLDER_ID_KEY,
  DRIVE_LAST_FOLDER_PATH_KEY,
] as const;

export interface DriveFolderCrumb {
  id: string;
  name: string;
}

export interface DriveSession {
  accessToken: string;
  expiresAt: number;
  accountEmail?: string;
}

/** Refresh local session state this many ms before token expiry. */
export const DRIVE_TOKEN_REFRESH_BUFFER_MS = 60_000;

export function driveSessionIsValid(session: DriveSession | null): session is DriveSession {
  if (!session?.accessToken) return false;
  if (!session.expiresAt) return true;
  return session.expiresAt - DRIVE_TOKEN_REFRESH_BUFFER_MS > Date.now();
}

/** Milliseconds until session is treated as expired, or null when unknown. */
export function msUntilDriveSessionExpiry(session: DriveSession | null): number | null {
  if (!session?.expiresAt) return null;
  return session.expiresAt - DRIVE_TOKEN_REFRESH_BUFFER_MS - Date.now();
}

function readItem(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeItem(key: string, value: string | null): void {
  try {
    if (value === null) {
      globalThis.localStorage?.removeItem(key);
    } else {
      globalThis.localStorage?.setItem(key, value);
    }
  } catch {
    // Ignore quota / disabled storage.
  }
}

export function loadDriveSession(): DriveSession | null {
  const accessToken = readItem(DRIVE_ACCESS_TOKEN_KEY);
  if (!accessToken) return null;
  const expiresRaw = readItem(DRIVE_TOKEN_EXPIRES_AT_KEY);
  const expiresAt = expiresRaw ? Number(expiresRaw) : 0;
  const accountEmail = readItem(DRIVE_LAST_ACCOUNT_KEY) ?? undefined;
  return { accessToken, expiresAt, accountEmail: accountEmail || undefined };
}

export function saveDriveSession(session: DriveSession): void {
  writeItem(DRIVE_ACCESS_TOKEN_KEY, session.accessToken);
  writeItem(DRIVE_TOKEN_EXPIRES_AT_KEY, String(session.expiresAt));
  if (session.accountEmail) {
    writeItem(DRIVE_LAST_ACCOUNT_KEY, session.accountEmail);
  }
}

export function clearDriveSession(): void {
  writeItem(DRIVE_ACCESS_TOKEN_KEY, null);
  writeItem(DRIVE_TOKEN_EXPIRES_AT_KEY, null);
}

export function loadDriveLastFolderId(): string | null {
  return readItem(DRIVE_LAST_FOLDER_ID_KEY);
}

export function saveDriveLastFolderId(folderId: string | null): void {
  writeItem(DRIVE_LAST_FOLDER_ID_KEY, folderId);
}

export function loadDriveLastFolderPath(): DriveFolderCrumb[] {
  const raw = readItem(DRIVE_LAST_FOLDER_PATH_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is DriveFolderCrumb =>
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as DriveFolderCrumb).id === 'string' &&
        typeof (entry as DriveFolderCrumb).name === 'string',
    );
  } catch {
    return [];
  }
}

export function saveDriveLastFolderPath(path: DriveFolderCrumb[]): void {
  if (path.length === 0) {
    writeItem(DRIVE_LAST_FOLDER_PATH_KEY, null);
    return;
  }
  writeItem(DRIVE_LAST_FOLDER_PATH_KEY, JSON.stringify(path));
}

export function loadDriveLastAccount(): string | null {
  return readItem(DRIVE_LAST_ACCOUNT_KEY);
}

export function saveDriveLastAccount(account: string | null): void {
  writeItem(DRIVE_LAST_ACCOUNT_KEY, account);
}

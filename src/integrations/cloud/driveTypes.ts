export const DRIVE_OAUTH_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';

export const DRIVE_ROOT_FOLDER_ID = 'root';

/**
 * Name of the app-owned Drive folder Studio creates on first connect. Under the
 * `drive.file` scope the app can only see files/folders it created (or that were
 * explicitly opened via a Picker-style flow, which Studio does not use) — so all
 * browsing, open, and save happens inside this one folder rather than arbitrary
 * pre-existing Drive folders.
 */
export const APP_ROOT_FOLDER_NAME = 'Codeplug Studio';

export interface DriveListItem {
  id: string;
  name: string;
  kind: 'folder' | 'yaml' | 'zip';
  modifiedTime?: string;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
}

export class DriveAuthError extends Error {
  readonly code = 'auth' as const;
  constructor(message = 'Google Drive authentication expired or missing.') {
    super(message);
    this.name = 'DriveAuthError';
  }
}

export class DriveCancelledError extends Error {
  readonly code = 'cancelled' as const;
  constructor(message = 'Google sign-in was cancelled.') {
    super(message);
    this.name = 'DriveCancelledError';
  }
}

export class DriveNetworkError extends Error {
  readonly code = 'network' as const;
  constructor(message = 'Google Drive request failed.') {
    super(message);
    this.name = 'DriveNetworkError';
  }
}

export class DriveScopeError extends Error {
  readonly code = 'scope' as const;
  constructor(message = 'Google Drive permission was denied.') {
    super(message);
    this.name = 'DriveScopeError';
  }
}

export class DriveNameConflictError extends Error {
  readonly code = 'nameConflict' as const;
  constructor(message = 'A folder with that name already exists.') {
    super(message);
    this.name = 'DriveNameConflictError';
  }
}

export class DriveConfigError extends Error {
  readonly code = 'config' as const;
  constructor(message = 'Google Drive is not configured for this build.') {
    super(message);
    this.name = 'DriveConfigError';
  }
}

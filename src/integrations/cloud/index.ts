import { isNativeApp } from '../platform/isNativeApp.ts';
import { createGoogleDrivePort } from './googleDrive.ts';
import { createNativeGoogleDrivePort } from './nativeGoogleDrive.ts';

export { handleDriveAuthFailure, isDriveAuthError } from './driveAuthFailure.ts';
export {
  clearDriveSession,
  clearPendingNativeAuth,
  DRIVE_ACCESS_TOKEN_KEY,
  DRIVE_PENDING_NATIVE_AUTH_KEY,
  DRIVE_REFRESH_TOKEN_KEY,
  DRIVE_TOKEN_REFRESH_BUFFER_MS,
  DRIVE_LAST_ACCOUNT_KEY,
  DRIVE_LAST_FOLDER_ID_KEY,
  DRIVE_LAST_FOLDER_PATH_KEY,
  DRIVE_STORAGE_KEYS,
  DRIVE_TOKEN_EXPIRES_AT_KEY,
  loadDriveLastAccount,
  loadDriveLastFolderId,
  loadDriveLastFolderPath,
  driveSessionIsValid,
  loadDriveSession,
  loadPendingNativeAuth,
  msUntilDriveSessionExpiry,
  saveDriveLastAccount,
  saveDriveLastFolderId,
  saveDriveLastFolderPath,
  saveDriveSession,
  savePendingNativeAuth,
  type DriveFolderCrumb,
  type DriveSession,
  type PendingNativeAuth,
} from './drivePrefs.ts';
export { createDriveApiClient, driveApi, type DriveApiClient } from './driveApi.ts';
export type { DriveAuthProvider, DriveAuthTokens } from './driveAuthProvider.ts';
export {
  createGoogleDrivePort,
  type GoogleDriveDeps,
  type GoogleDrivePort,
} from './googleDrive.ts';
export { getActiveGoogleClientId } from './googleClientIds.ts';
export { createNativeGoogleDrivePort } from './nativeGoogleDrive.ts';
export { NATIVE_OAUTH_REDIRECT_URI, getGoogleAndroidClientId } from './nativeGoogleAuth.ts';
export {
  registerNativeAuthRedirectListener,
  resetNativeAuthRedirectListenerForTests,
} from './nativeAuthRedirect.ts';
export {
  DRIVE_FOLDER_MIME,
  DRIVE_OAUTH_SCOPE,
  DRIVE_ROOT_FOLDER_ID,
  DriveAuthError,
  DriveCancelledError,
  DriveConfigError,
  DriveNameConflictError,
  DriveNetworkError,
  DriveScopeError,
  type DriveFileMetadata,
  type DriveListItem,
} from './driveTypes.ts';
export { getGoogleClientId, loadGoogleIdentity } from './loadGoogleIdentity.ts';
export { createWebAuthProvider } from './webGoogleAuth.ts';

export const googleDrivePort = isNativeApp()
  ? createNativeGoogleDrivePort()
  : createGoogleDrivePort();

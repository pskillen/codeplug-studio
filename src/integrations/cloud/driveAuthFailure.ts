import { clearDriveSession } from './drivePrefs.ts';
import { DriveAuthError } from './driveTypes.ts';

export function isDriveAuthError(err: unknown): err is DriveAuthError {
  return err instanceof DriveAuthError;
}

/**
 * Clears a stale Drive OAuth session after an auth failure.
 * Returns true when the error was a {@link DriveAuthError}.
 */
export function handleDriveAuthFailure(err: unknown): boolean {
  if (!isDriveAuthError(err)) return false;
  clearDriveSession();
  return true;
}

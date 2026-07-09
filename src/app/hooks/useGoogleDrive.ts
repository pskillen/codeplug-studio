import type { DriveConnectResult } from './useDriveSession.ts';
import { useDriveSession } from './useDriveSession.ts';

/** @deprecated Prefer {@link useDriveSession} — thin alias for backward compatibility. */
export type { DriveConnectResult };

export function useGoogleDrive() {
  return useDriveSession();
}

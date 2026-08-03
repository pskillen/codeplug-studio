import type { DriveSession } from './drivePrefs.ts';

export interface DriveAuthTokens {
  accessToken: string;
  expiresAt: number;
  refreshToken?: string;
}

export interface DriveAuthProvider {
  authorize(clientId: string): Promise<DriveAuthTokens>;
  revoke(session: DriveSession): Promise<void>;
  tryRefresh?(session: DriveSession, clientId: string): Promise<DriveAuthTokens | null>;
}

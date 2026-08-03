import { DriveAuthError, DriveCancelledError, DRIVE_OAUTH_SCOPE } from './driveTypes.ts';
import type { DriveAuthProvider, DriveAuthTokens } from './driveAuthProvider.ts';
import type { DriveSession } from './drivePrefs.ts';
import {
  loadGoogleIdentity,
  type GoogleIdentityClient,
} from './loadGoogleIdentity.ts';

function requestAccessToken(
  identity: GoogleIdentityClient,
  clientId: string,
): Promise<DriveAuthTokens> {
  return new Promise((resolve, reject) => {
    const client = identity.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_OAUTH_SCOPE,
      callback: (response) => {
        if (response.error) {
          if (response.error === 'popup_closed_by_user' || response.error === 'access_denied') {
            reject(new DriveCancelledError(response.error_description));
            return;
          }
          reject(new DriveAuthError(response.error_description ?? response.error));
          return;
        }
        if (!response.access_token) {
          reject(new DriveAuthError('No access token returned.'));
          return;
        }
        const expiresInMs = (response.expires_in ?? 3600) * 1000;
        resolve({
          accessToken: response.access_token,
          expiresAt: Date.now() + expiresInMs,
        });
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed') {
          reject(new DriveCancelledError());
          return;
        }
        reject(new DriveAuthError(error.message));
      },
    });
    client.requestAccessToken({ prompt: '' });
  });
}

export interface WebGoogleAuthDeps {
  loadIdentity: () => Promise<GoogleIdentityClient>;
}

export function createWebAuthProvider(
  deps?: Partial<WebGoogleAuthDeps>,
): DriveAuthProvider {
  const loadIdentity = deps?.loadIdentity ?? loadGoogleIdentity;

  return {
    async authorize(clientId) {
      const identity = await loadIdentity();
      return requestAccessToken(identity, clientId);
    },

    async revoke(session) {
      if (!session.accessToken) return;
      try {
        const identity = await loadIdentity();
        await new Promise<void>((resolve) => {
          identity.accounts.oauth2.revoke(session.accessToken, () => resolve());
        });
      } catch {
        // Best-effort revoke.
      }
    },
  };
}

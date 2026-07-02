import { createDriveApiClient, type DriveApiClient, driveApi } from './driveApi.ts';
import {
  clearDriveSession,
  loadDriveSession,
  saveDriveLastAccount,
  saveDriveSession,
  type DriveSession,
} from './drivePrefs.ts';
import {
  DriveAuthError,
  DriveCancelledError,
  DriveConfigError,
  DRIVE_OAUTH_SCOPE,
  type DriveFileMetadata,
  type DriveListItem,
} from './driveTypes.ts';
import {
  getGoogleClientId,
  loadGoogleIdentity,
  type GoogleIdentityClient,
  type GoogleTokenClient,
} from './loadGoogleIdentity.ts';

export interface GoogleDrivePort {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getAccountLabel(): string | null;
  listChildren(parentId: string): Promise<DriveListItem[]>;
  createFolder(parentId: string, name: string): Promise<DriveFileMetadata>;
  readFile(fileId: string): Promise<string>;
  writeFile(params: {
    parentId: string;
    fileName: string;
    content: string;
    fileId?: string;
  }): Promise<DriveFileMetadata>;
  getFileMetadata(fileId: string): Promise<DriveFileMetadata>;
}

export interface GoogleDriveDeps {
  api: DriveApiClient;
  loadIdentity: () => Promise<GoogleIdentityClient>;
  fetchImpl: typeof fetch;
  getClientId: () => string;
}

const TOKEN_REFRESH_BUFFER_MS = 60_000;

function sessionIsValid(session: DriveSession | null): session is DriveSession {
  if (!session?.accessToken) return false;
  if (!session.expiresAt) return true;
  return session.expiresAt - TOKEN_REFRESH_BUFFER_MS > Date.now();
}

function requireClientId(getClientId: () => string): string {
  const clientId = getClientId();
  if (!clientId) throw new DriveConfigError();
  return clientId;
}

function requestAccessToken(
  identity: GoogleIdentityClient,
  clientId: string,
): Promise<{ accessToken: string; expiresAt: number }> {
  return new Promise((resolve, reject) => {
    let client: GoogleTokenClient | null = null;
    client = identity.accounts.oauth2.initTokenClient({
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

export function createGoogleDrivePort(deps?: Partial<GoogleDriveDeps>): GoogleDrivePort {
  const resolved: GoogleDriveDeps = {
    api: deps?.api ?? driveApi,
    loadIdentity: deps?.loadIdentity ?? loadGoogleIdentity,
    fetchImpl: deps?.fetchImpl ?? fetch,
    getClientId: deps?.getClientId ?? getGoogleClientId,
  };

  if (deps?.fetchImpl) {
    resolved.api = deps.api ?? createDriveApiClient(deps.fetchImpl);
  }

  function getValidSession(): DriveSession {
    const session = loadDriveSession();
    if (!sessionIsValid(session)) {
      throw new DriveAuthError();
    }
    return session;
  }

  return {
    async connect() {
      const clientId = requireClientId(resolved.getClientId);
      const identity = await resolved.loadIdentity();
      const token = await requestAccessToken(identity, clientId);
      let accountEmail = loadDriveSession()?.accountEmail;
      try {
        const email = await resolved.api.getUserEmail(token.accessToken);
        if (email) {
          accountEmail = email;
          saveDriveLastAccount(email);
        }
      } catch {
        // Account label is optional when userinfo fails.
      }
      saveDriveSession({
        accessToken: token.accessToken,
        expiresAt: token.expiresAt,
        accountEmail,
      });
    },

    async disconnect() {
      const session = loadDriveSession();
      if (session?.accessToken) {
        try {
          const identity = await resolved.loadIdentity();
          await new Promise<void>((resolve) => {
            identity.accounts.oauth2.revoke(session.accessToken, () => resolve());
          });
        } catch {
          // Best-effort revoke.
        }
      }
      clearDriveSession();
    },

    isConnected() {
      return sessionIsValid(loadDriveSession());
    },

    getAccountLabel() {
      const session = loadDriveSession();
      return session?.accountEmail ?? null;
    },

    async listChildren(parentId) {
      const session = getValidSession();
      return resolved.api.listChildren(parentId, session.accessToken);
    },

    async createFolder(parentId, name) {
      const session = getValidSession();
      return resolved.api.createFolder(parentId, name, session.accessToken);
    },

    async readFile(fileId) {
      const session = getValidSession();
      return resolved.api.readFile(fileId, session.accessToken);
    },

    async writeFile(params) {
      const session = getValidSession();
      return resolved.api.writeFile(params, session.accessToken);
    },

    async getFileMetadata(fileId) {
      const session = getValidSession();
      return resolved.api.getFileMetadata(fileId, session.accessToken);
    },
  };
}

export const googleDrivePort = createGoogleDrivePort();

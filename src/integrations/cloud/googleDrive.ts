import { createDriveApiClient, type DriveApiClient, driveApi } from './driveApi.ts';
import type { DriveAuthProvider } from './driveAuthProvider.ts';
import {
  clearDriveSession,
  driveSessionIsValid,
  loadDriveSession,
  saveDriveLastAccount,
  saveDriveSession,
  type DriveSession,
} from './drivePrefs.ts';
import {
  DriveAuthError,
  DriveConfigError,
  type DriveFileMetadata,
  type DriveListItem,
} from './driveTypes.ts';
import { getGoogleClientId } from './loadGoogleIdentity.ts';
import { createWebAuthProvider } from './webGoogleAuth.ts';

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
  writeBinaryFile(params: {
    parentId: string;
    fileName: string;
    content: Uint8Array;
    mimeType?: string;
    fileId?: string;
  }): Promise<DriveFileMetadata>;
  getFileMetadata(fileId: string): Promise<DriveFileMetadata>;
}

export interface GoogleDriveDeps {
  api: DriveApiClient;
  authProvider: DriveAuthProvider;
  fetchImpl: typeof fetch;
  getClientId: () => string;
}

function requireClientId(getClientId: () => string): string {
  const clientId = getClientId();
  if (!clientId) throw new DriveConfigError();
  return clientId;
}

export function createGoogleDrivePort(deps?: Partial<GoogleDriveDeps>): GoogleDrivePort {
  const resolved: GoogleDriveDeps = {
    api: deps?.api ?? driveApi,
    authProvider: deps?.authProvider ?? createWebAuthProvider(),
    fetchImpl: deps?.fetchImpl ?? fetch,
    getClientId: deps?.getClientId ?? getGoogleClientId,
  };

  if (deps?.fetchImpl) {
    resolved.api = deps.api ?? createDriveApiClient(deps.fetchImpl);
  }

  async function getValidSession(): Promise<DriveSession> {
    const session = loadDriveSession();
    if (driveSessionIsValid(session)) {
      return session;
    }

    if (session?.refreshToken && resolved.authProvider.tryRefresh) {
      const clientId = resolved.getClientId();
      if (clientId) {
        const refreshed = await resolved.authProvider.tryRefresh(session, clientId);
        if (refreshed) {
          const newSession: DriveSession = {
            accessToken: refreshed.accessToken,
            expiresAt: refreshed.expiresAt,
            accountEmail: session.accountEmail,
            refreshToken: refreshed.refreshToken ?? session.refreshToken,
          };
          saveDriveSession(newSession);
          return newSession;
        }
      }
    }

    throw new DriveAuthError();
  }

  return {
    async connect() {
      const clientId = requireClientId(resolved.getClientId);
      const tokens = await resolved.authProvider.authorize(clientId);
      let accountEmail = loadDriveSession()?.accountEmail;
      try {
        const email = await resolved.api.getUserEmail(tokens.accessToken);
        if (email) {
          accountEmail = email;
          saveDriveLastAccount(email);
        }
      } catch {
        // Account label is optional when userinfo fails.
      }
      saveDriveSession({
        accessToken: tokens.accessToken,
        expiresAt: tokens.expiresAt,
        accountEmail,
        refreshToken: tokens.refreshToken,
      });
    },

    async disconnect() {
      const session = loadDriveSession();
      if (session) {
        try {
          await resolved.authProvider.revoke(session);
        } catch {
          // Best-effort revoke.
        }
      }
      clearDriveSession();
    },

    isConnected() {
      return driveSessionIsValid(loadDriveSession());
    },

    getAccountLabel() {
      const session = loadDriveSession();
      return session?.accountEmail ?? null;
    },

    async listChildren(parentId) {
      const session = await getValidSession();
      return resolved.api.listChildren(parentId, session.accessToken);
    },

    async createFolder(parentId, name) {
      const session = await getValidSession();
      return resolved.api.createFolder(parentId, name, session.accessToken);
    },

    async readFile(fileId) {
      const session = await getValidSession();
      return resolved.api.readFile(fileId, session.accessToken);
    },

    async writeFile(params) {
      const session = await getValidSession();
      return resolved.api.writeFile(params, session.accessToken);
    },

    async writeBinaryFile(params) {
      const session = await getValidSession();
      return resolved.api.writeBinaryFile(params, session.accessToken);
    },

    async getFileMetadata(fileId) {
      const session = await getValidSession();
      return resolved.api.getFileMetadata(fileId, session.accessToken);
    },
  };
}

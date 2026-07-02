import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGoogleDrivePort } from './googleDrive.ts';
import { clearDriveSession, loadDriveSession, saveDriveSession } from './drivePrefs.ts';
import { DriveAuthError, DriveCancelledError, DriveConfigError } from './driveTypes.ts';
import type { DriveApiClient } from './driveApi.ts';
import type { GoogleIdentityClient } from './loadGoogleIdentity.ts';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

describe('googleDrive port', () => {
  const api: DriveApiClient = {
    listChildren: vi.fn(async () => [{ id: 'f1', name: 'Folder', kind: 'folder' as const }]),
    createFolder: vi.fn(async () => ({
      id: 'nf',
      name: 'New',
      mimeType: 'application/vnd.google-apps.folder',
    })),
    readFile: vi.fn(async () => 'yaml-content'),
    writeFile: vi.fn(async () => ({ id: 'wf', name: 'demo.yaml', mimeType: 'application/yaml' })),
    getFileMetadata: vi.fn(async () => ({
      id: 'wf',
      name: 'demo.yaml',
      mimeType: 'application/yaml',
    })),
    getUserEmail: vi.fn(async () => 'op@example.com'),
  };

  const identity: GoogleIdentityClient = {
    accounts: {
      oauth2: {
        initTokenClient: vi.fn(({ callback }) => ({
          requestAccessToken: () => {
            callback({ access_token: 'ya29.test', expires_in: 3600 });
          },
        })),
        revoke: vi.fn((_token, done) => {
          done();
        }),
      },
    },
  };

  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearDriveSession();
  });

  it('connect stores session and account label', async () => {
    const port = createGoogleDrivePort({
      api,
      loadIdentity: async () => identity,
      getClientId: () => 'client-id.apps.googleusercontent.com',
      fetchImpl: fetch,
    });
    await port.connect();
    expect(port.isConnected()).toBe(true);
    expect(port.getAccountLabel()).toBe('op@example.com');
    expect(loadDriveSession()?.accessToken).toBe('ya29.test');
  });

  it('disconnect clears session', async () => {
    saveDriveSession({
      accessToken: 'ya29.test',
      expiresAt: Date.now() + 3_600_000,
      accountEmail: 'op@example.com',
    });
    const port = createGoogleDrivePort({
      api,
      loadIdentity: async () => identity,
      getClientId: () => 'client-id.apps.googleusercontent.com',
      fetchImpl: fetch,
    });
    await port.disconnect();
    expect(port.isConnected()).toBe(false);
    expect(loadDriveSession()).toBeNull();
  });

  it('requires configuration for connect', async () => {
    const port = createGoogleDrivePort({
      api,
      loadIdentity: async () => identity,
      getClientId: () => '',
      fetchImpl: fetch,
    });
    await expect(port.connect()).rejects.toBeInstanceOf(DriveConfigError);
  });

  it('maps cancelled sign-in', async () => {
    const cancelledIdentity: GoogleIdentityClient = {
      accounts: {
        oauth2: {
          initTokenClient: vi.fn(({ callback }) => ({
            requestAccessToken: () => {
              callback({ error: 'popup_closed_by_user' });
            },
          })),
          revoke: vi.fn((_token, done) => {
            done();
          }),
        },
      },
    };
    const port = createGoogleDrivePort({
      api,
      loadIdentity: async () => cancelledIdentity,
      getClientId: () => 'client-id.apps.googleusercontent.com',
      fetchImpl: fetch,
    });
    await expect(port.connect()).rejects.toBeInstanceOf(DriveCancelledError);
  });

  it('delegates listChildren to api with stored token', async () => {
    saveDriveSession({
      accessToken: 'ya29.test',
      expiresAt: Date.now() + 3_600_000,
    });
    const port = createGoogleDrivePort({
      api,
      loadIdentity: async () => identity,
      getClientId: () => 'client-id',
      fetchImpl: fetch,
    });
    const children = await port.listChildren('root');
    expect(children).toHaveLength(1);
    expect(api.listChildren).toHaveBeenCalledWith('root', 'ya29.test');
  });

  it('throws when session expired', async () => {
    saveDriveSession({
      accessToken: 'ya29.test',
      expiresAt: Date.now() - 1,
    });
    const port = createGoogleDrivePort({
      api,
      loadIdentity: async () => identity,
      getClientId: () => 'client-id',
      fetchImpl: fetch,
    });
    await expect(port.readFile('file-1')).rejects.toBeInstanceOf(DriveAuthError);
  });
});

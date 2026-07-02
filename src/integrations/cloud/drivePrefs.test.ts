import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearDriveSession,
  DRIVE_ACCESS_TOKEN_KEY,
  DRIVE_LAST_FOLDER_ID_KEY,
  DRIVE_LAST_FOLDER_PATH_KEY,
  loadDriveLastFolderId,
  loadDriveLastFolderPath,
  loadDriveSession,
  saveDriveLastFolderId,
  saveDriveLastFolderPath,
  saveDriveSession,
} from './drivePrefs.ts';

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

beforeEach(() => {
  vi.stubGlobal('localStorage', createLocalStorageMock());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('drivePrefs', () => {
  it('round-trips drive session', () => {
    saveDriveSession({
      accessToken: 'ya29.test',
      expiresAt: 1_700_000_000_000,
      accountEmail: 'op@example.com',
    });
    expect(loadDriveSession()).toEqual({
      accessToken: 'ya29.test',
      expiresAt: 1_700_000_000_000,
      accountEmail: 'op@example.com',
    });
    clearDriveSession();
    expect(loadDriveSession()).toBeNull();
    expect(localStorage.getItem(DRIVE_ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('round-trips browse folder id and breadcrumb path', () => {
    saveDriveLastFolderId('folder-abc');
    expect(loadDriveLastFolderId()).toBe('folder-abc');
    saveDriveLastFolderPath([
      { id: 'root', name: 'My Drive' },
      { id: 'folder-abc', name: 'Codeplugs' },
    ]);
    expect(loadDriveLastFolderPath()).toEqual([
      { id: 'root', name: 'My Drive' },
      { id: 'folder-abc', name: 'Codeplugs' },
    ]);
    saveDriveLastFolderPath([]);
    expect(localStorage.getItem(DRIVE_LAST_FOLDER_PATH_KEY)).toBeNull();
  });
});

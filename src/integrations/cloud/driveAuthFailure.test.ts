import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDriveSession, loadDriveSession, saveDriveSession } from './drivePrefs.ts';
import { handleDriveAuthFailure, isDriveAuthError } from './driveAuthFailure.ts';
import { DriveAuthError, DriveNetworkError } from './driveTypes.ts';

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

describe('driveAuthFailure', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    saveDriveSession({
      accessToken: 'ya29.test',
      expiresAt: Date.now() + 3_600_000,
      accountEmail: 'op@example.com',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearDriveSession();
  });

  it('isDriveAuthError narrows DriveAuthError', () => {
    expect(isDriveAuthError(new DriveAuthError())).toBe(true);
    expect(isDriveAuthError(new DriveNetworkError())).toBe(false);
    expect(isDriveAuthError(new Error('other'))).toBe(false);
  });

  it('handleDriveAuthFailure clears session for DriveAuthError', () => {
    expect(handleDriveAuthFailure(new DriveAuthError('expired'))).toBe(true);
    expect(loadDriveSession()).toBeNull();
  });

  it('handleDriveAuthFailure leaves session for other errors', () => {
    expect(handleDriveAuthFailure(new DriveNetworkError())).toBe(false);
    expect(loadDriveSession()?.accessToken).toBe('ya29.test');
  });
});

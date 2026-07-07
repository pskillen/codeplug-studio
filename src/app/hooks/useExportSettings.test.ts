import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  legacyExportSettingsFromLocalStorage,
  clearLegacyExportSettingsLocalStorage,
  buildNeedsLegacyExportSettingsMigration,
} from '../lib/migrateLegacyExportSettings.ts';
import { STORAGE_KEY_EXPORT_SHORTEN_NAMES } from './useExportSettings.ts';

function createStorageMock() {
  const storage = new Map<string, string>();
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
  };
}

describe('legacy export settings migration', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads legacy localStorage values into build export settings', () => {
    localStorage.setItem(STORAGE_KEY_EXPORT_SHORTEN_NAMES, 'false');
    expect(legacyExportSettingsFromLocalStorage().shortenNames).toBe(false);
  });

  it('detects builds without export settings', () => {
    expect(buildNeedsLegacyExportSettingsMigration({})).toBe(true);
    expect(
      buildNeedsLegacyExportSettingsMigration({ exportSettings: { shortenNames: true } }),
    ).toBe(false);
  });

  it('clears legacy localStorage keys', () => {
    localStorage.setItem(STORAGE_KEY_EXPORT_SHORTEN_NAMES, 'false');
    clearLegacyExportSettingsLocalStorage();
    expect(localStorage.getItem(STORAGE_KEY_EXPORT_SHORTEN_NAMES)).toBeNull();
  });
});

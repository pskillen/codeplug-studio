import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEY_EXPORT_NAME_MODE_OVERRIDE,
  resetExportSettingsForTests,
  useExportSettings,
} from './useExportSettings.ts';

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

describe('useExportSettings', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createStorageMock());
    resetExportSettingsForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetExportSettingsForTests();
  });

  it('syncs name mode changes across hook instances', () => {
    const { result: first } = renderHook(() => useExportSettings());
    const { result: second } = renderHook(() => useExportSettings());

    act(() => {
      first.current.setNameModeOverride('callsign_only');
    });

    expect(second.current.nameModeOverride).toBe('callsign_only');
    expect(localStorage.getItem(STORAGE_KEY_EXPORT_NAME_MODE_OVERRIDE)).toBe('callsign_only');
  });

  it('defaults useChannelAbbreviation to on until explicitly disabled', () => {
    const { result } = renderHook(() => useExportSettings());
    expect(result.current.useChannelAbbreviation).toBe(true);

    act(() => {
      result.current.setUseChannelAbbreviation(false);
    });
    expect(result.current.useChannelAbbreviation).toBe(false);
  });
});

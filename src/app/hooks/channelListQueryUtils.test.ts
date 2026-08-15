import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DATATABLE_CALLSIGN_SORT_KEY } from '../lib/dataTable/sort.ts';
import { usePersistedColumnVisibility } from '../lib/libraryListTable.tsx';
import { channelListColumnsKey } from '@integrations/listPrefs/index.ts';
import { saveStringArray } from '@integrations/listPrefs/columnVisibility.ts';
import {
  channelTableHideableColumns,
  defaultChannelTableVisibleColumns,
  loadChannelVisibleColumns,
} from './channelListQueryUtils.ts';

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

describe('channel table column visibility', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('treats Callsign as a hideable table column', () => {
    expect(
      channelTableHideableColumns().some((col) => col.key === DATATABLE_CALLSIGN_SORT_KEY),
    ).toBe(true);
    expect(defaultChannelTableVisibleColumns()).toContain(DATATABLE_CALLSIGN_SORT_KEY);
  });

  it('keeps Callsign when loading and saving table column prefs', () => {
    const projectId = 'proj-callsign';
    saveStringArray(channelListColumnsKey(projectId), [
      DATATABLE_CALLSIGN_SORT_KEY,
      'band',
      'mode',
    ]);

    expect(loadChannelVisibleColumns(projectId)).toEqual([
      DATATABLE_CALLSIGN_SORT_KEY,
      'band',
      'mode',
    ]);
  });

  it('persists enabling Callsign instead of stripping the key', () => {
    const projectId = 'proj-enable-callsign';
    const storageKey = channelListColumnsKey(projectId);
    saveStringArray(storageKey, ['band']);

    const { result } = renderHook(() =>
      usePersistedColumnVisibility(storageKey, channelTableHideableColumns(), () =>
        loadChannelVisibleColumns(projectId),
      ),
    );

    act(() => {
      result.current[1]([...result.current[0], DATATABLE_CALLSIGN_SORT_KEY]);
    });

    expect(result.current[0]).toContain(DATATABLE_CALLSIGN_SORT_KEY);
    expect(loadChannelVisibleColumns(projectId)).toContain(DATATABLE_CALLSIGN_SORT_KEY);
  });
});

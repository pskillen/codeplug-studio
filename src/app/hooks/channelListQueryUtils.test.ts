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

  it('does not treat Callsign, Band, or Mode as separate hideable table columns', () => {
    const keys = channelTableHideableColumns().map((col) => col.key);
    expect(keys).not.toContain(DATATABLE_CALLSIGN_SORT_KEY);
    expect(keys).not.toContain('band');
    expect(keys).not.toContain('mode');
  });

  it('adds Tone as a hideable table column, hidden by default, right after Frequency', () => {
    const keys = channelTableHideableColumns().map((col) => col.key);
    const toneIndex = keys.indexOf('tone');
    const frequencyIndex = keys.indexOf('rxTx');
    expect(toneIndex).toBeGreaterThan(-1);
    expect(toneIndex).toBe(frequencyIndex + 1);

    const toneCol = channelTableHideableColumns().find((col) => col.key === 'tone');
    expect(toneCol?.defaultVisible).toBe(false);
    expect(defaultChannelTableVisibleColumns()).not.toContain('tone');
  });

  it('persists enabling Tone instead of stripping the key', () => {
    const projectId = 'proj-enable-tone';
    const storageKey = channelListColumnsKey(projectId);
    saveStringArray(storageKey, ['zones']);

    const { result } = renderHook(() =>
      usePersistedColumnVisibility(storageKey, channelTableHideableColumns(), () =>
        loadChannelVisibleColumns(projectId),
      ),
    );

    act(() => {
      result.current[1]([...result.current[0], 'tone']);
    });

    expect(result.current[0]).toContain('tone');
    expect(loadChannelVisibleColumns(projectId)).toContain('tone');
  });
});

import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  channelListPrefsKey,
  entityListPrefsKey,
  saveChannelListPrefs,
  saveEntityListPrefs,
} from '@integrations/listPrefs/index.ts';
import { saveActiveProjectId } from '@integrations/preferences/index.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { ProjectContext, type ProjectContextValue } from '../state/ProjectContext.ts';
import { LIST_NAME_FILTER_DEBOUNCE_MS } from './useDebouncedNameFilter.ts';
import { useChannelListQuery } from './useChannelListQuery.ts';
import { useListNameQuery } from './useListNameQuery.ts';

const TEST_PROJECT_ID = 'project-test-1';

function makeProjectMeta(projectId: string): ProjectMeta {
  return {
    id: projectId,
    projectId,
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test',
    description: '',
    notes: '',
    author: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeProjectsWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const value = useMemo<ProjectContextValue>(
      () => ({
        projects: [makeProjectMeta(TEST_PROJECT_ID)],
        activeProjectId: TEST_PROJECT_ID,
        activeProject: makeProjectMeta(TEST_PROJECT_ID),
        loading: false,
        createProject: async () => {},
        switchProject: () => {},
        renameProject: async () => {},
        deleteProject: async () => {},
      }),
      [],
    );

    return (
      <MemoryRouter initialEntries={initialEntries}>
        <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
      </MemoryRouter>
    );
  };
}

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

describe('useChannelListQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    saveActiveProjectId(TEST_PROJECT_ID);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reads defaults from empty search params', () => {
    const { result } = renderHook(() => useChannelListQuery(), {
      wrapper: makeProjectsWrapper(['/channels']),
    });

    expect(result.current.nameFilter).toBe('');
    expect(result.current.nameFilterInput).toBe('');
    expect(result.current.nameFilterPending).toBe(false);
    expect(result.current.sortMode).toBe('name');
    expect(result.current.bandFilter).toEqual([]);
    expect(result.current.distanceFilterEnabled).toBe(false);
    expect(result.current.maxDistanceKm).toBe(25);
  });

  it('round-trips filter params in the URL', () => {
    const { result } = renderHook(() => useChannelListQuery(), {
      wrapper: makeProjectsWrapper([
        '/channels?q=gb3le&sort=distance&band=2m,70cm&mode=DMR&duplex=simplex&distance=1&maxKm=50',
      ]),
    });

    expect(result.current.nameFilter).toBe('gb3le');
    expect(result.current.nameFilterInput).toBe('gb3le');
    expect(result.current.sortMode).toBe('distance');
    expect(result.current.bandFilter).toEqual(['2m', '70cm']);
    expect(result.current.modeFilter).toEqual(['DMR']);
    expect(result.current.duplexFilter).toBe('simplex');
    expect(result.current.distanceFilterEnabled).toBe(true);
    expect(result.current.maxDistanceKm).toBe(50);
  });

  it('debounces name filter before updating committed value', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useChannelListQuery(), {
      wrapper: makeProjectsWrapper(['/channels']),
    });

    act(() => {
      result.current.setNameFilter('repeater');
    });
    expect(result.current.nameFilterInput).toBe('repeater');
    expect(result.current.nameFilter).toBe('');
    expect(result.current.nameFilterPending).toBe(true);

    act(() => {
      vi.advanceTimersByTime(LIST_NAME_FILTER_DEBOUNCE_MS);
    });
    expect(result.current.nameFilter).toBe('repeater');
    expect(result.current.nameFilterPending).toBe(false);
  });

  it('hydrates from localStorage when URL has no params', async () => {
    saveChannelListPrefs(TEST_PROJECT_ID, {
      q: 'stored',
      sortMode: 'distance',
      band: ['2m'],
    });

    const { result } = renderHook(() => useChannelListQuery(), {
      wrapper: makeProjectsWrapper(['/channels']),
    });

    await waitFor(() => expect(result.current.nameFilter).toBe('stored'));
    expect(result.current.sortMode).toBe('distance');
    expect(result.current.bandFilter).toEqual(['2m']);
  });

  it('URL params win over localStorage on load', () => {
    saveChannelListPrefs(TEST_PROJECT_ID, { q: 'stored' });

    const { result } = renderHook(() => useChannelListQuery(), {
      wrapper: makeProjectsWrapper(['/channels?q=url-wins']),
    });

    expect(result.current.nameFilter).toBe('url-wins');
  });

  it('persists filter changes to localStorage', async () => {
    const { result } = renderHook(() => useChannelListQuery(), {
      wrapper: makeProjectsWrapper(['/channels']),
    });

    act(() => {
      result.current.setBandFilter(['70cm']);
    });
    await waitFor(() => expect(result.current.bandFilter).toEqual(['70cm']));

    const stored = JSON.parse(localStorage.getItem(channelListPrefsKey(TEST_PROJECT_ID))!);
    expect(stored.band).toEqual(['70cm']);
  });

  it('does not restore stale localStorage q when clearing the name filter', () => {
    vi.useFakeTimers();
    saveChannelListPrefs(TEST_PROJECT_ID, { q: 'stored' });

    const { result } = renderHook(() => useChannelListQuery(), {
      wrapper: makeProjectsWrapper(['/channels']),
    });

    act(() => {
      vi.runAllTimers();
    });
    expect(result.current.nameFilter).toBe('stored');

    act(() => {
      result.current.setNameFilter('');
    });
    expect(result.current.nameFilterInput).toBe('');
    expect(result.current.nameFilter).toBe('stored');

    act(() => {
      vi.advanceTimersByTime(LIST_NAME_FILTER_DEBOUNCE_MS);
    });
    expect(result.current.nameFilter).toBe('');

    const stored = JSON.parse(localStorage.getItem(channelListPrefsKey(TEST_PROJECT_ID))!);
    expect(stored.q).toBe('');
  });
});

describe('useListNameQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
    saveActiveProjectId(TEST_PROJECT_ID);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('hydrates name filter from localStorage', async () => {
    saveEntityListPrefs('zones', TEST_PROJECT_ID, { q: 'north' });

    const { result } = renderHook(() => useListNameQuery('zones'), {
      wrapper: makeProjectsWrapper(['/zones']),
    });

    await waitFor(() => expect(result.current.nameFilter).toBe('north'));
  });

  it('URL q wins over stored prefs', () => {
    saveEntityListPrefs('zones', TEST_PROJECT_ID, { q: 'stored' });

    const { result } = renderHook(() => useListNameQuery('zones'), {
      wrapper: makeProjectsWrapper(['/zones?q=url']),
    });

    expect(result.current.nameFilter).toBe('url');
  });

  it('isolates prefs by entity and URL param', async () => {
    saveEntityListPrefs('zones', TEST_PROJECT_ID, { q: 'zone-a' });
    saveEntityListPrefs('digital-contacts', TEST_PROJECT_ID, { q: 'digital-b' });
    saveEntityListPrefs('analog-contacts', TEST_PROJECT_ID, { q: 'analog-c' });

    const zones = renderHook(() => useListNameQuery('zones'), {
      wrapper: makeProjectsWrapper(['/zones']),
    });
    await waitFor(() => expect(zones.result.current.nameFilter).toBe('zone-a'));

    const digital = renderHook(() => useListNameQuery('digital-contacts'), {
      wrapper: makeProjectsWrapper(['/contacts']),
    });
    await waitFor(() => expect(digital.result.current.nameFilter).toBe('digital-b'));

    const analog = renderHook(() => useListNameQuery('analog-contacts'), {
      wrapper: makeProjectsWrapper(['/contacts']),
    });
    await waitFor(() => expect(analog.result.current.nameFilter).toBe('analog-c'));
  });

  it('persists name filter to localStorage after debounce', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useListNameQuery('talk-groups'), {
      wrapper: makeProjectsWrapper(['/talk-groups']),
    });

    act(() => {
      result.current.setNameFilter('local');
    });
    act(() => {
      vi.advanceTimersByTime(LIST_NAME_FILTER_DEBOUNCE_MS);
    });
    expect(result.current.nameFilter).toBe('local');

    const stored = JSON.parse(
      localStorage.getItem(entityListPrefsKey('talk-groups', TEST_PROJECT_ID))!,
    );
    expect(stored.q).toBe('local');
  });

  it('does not restore stale localStorage q when clearing the name filter', () => {
    vi.useFakeTimers();
    saveEntityListPrefs('zones', TEST_PROJECT_ID, { q: 'north' });

    const { result } = renderHook(() => useListNameQuery('zones'), {
      wrapper: makeProjectsWrapper(['/zones']),
    });

    act(() => {
      vi.runAllTimers();
    });
    expect(result.current.nameFilter).toBe('north');

    act(() => {
      result.current.setNameFilter('');
    });
    act(() => {
      vi.advanceTimersByTime(LIST_NAME_FILTER_DEBOUNCE_MS);
    });
    expect(result.current.nameFilter).toBe('');

    const stored = JSON.parse(localStorage.getItem(entityListPrefsKey('zones', TEST_PROJECT_ID))!);
    expect(stored.q).toBe('');
  });
});

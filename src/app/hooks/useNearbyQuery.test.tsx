import { renderHook, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nearbyPrefsKey, saveNearbyPrefs } from '@integrations/listPrefs/index.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { ProjectContext, type ProjectContextValue } from '../state/ProjectContext.ts';
import { DEFAULT_NEARBY_RADIUS_KM } from '../lib/nearbyRepeaters.ts';
import { useNearbyQuery } from './useNearbyQuery.ts';

const PROJECT_ID = 'project-test-1';

function makeProjectMeta(): ProjectMeta {
  return {
    id: PROJECT_ID,
    projectId: PROJECT_ID,
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test',
    description: '',
    notes: '',
    author: '',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeWrapper(initialEntries: string[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const value = useMemo<ProjectContextValue>(
      () => ({
        projects: [makeProjectMeta()],
        activeProjectId: PROJECT_ID,
        activeProject: makeProjectMeta(),
        loading: false,
        createProject: async () => {},
        switchProject: () => {},
        renameProject: async () => {},
        deleteProject: async () => {},
        refreshProjects: async () => {},
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

function useProbe() {
  const query = useNearbyQuery();
  const [params] = useSearchParams();
  return { query, params };
}

describe('useNearbyQuery', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies stored prefs on the first render and keeps the search point in the URL', async () => {
    saveNearbyPrefs({ sources: ['ukrepeater', 'library'], bands: ['70cm'], radiusKm: 60 });
    const { result } = renderHook(() => useProbe(), {
      wrapper: makeWrapper(['/tools/nearby?lat=55.86&lon=-4.25']),
    });
    expect(result.current.query.bands).toEqual(['70cm']);
    expect(result.current.query.radiusKm).toBe(60);
    await waitFor(() => expect(result.current.params.get('b')).toBe('70cm'));
    expect(result.current.params.get('s')).toBe('ukrepeater,library');
    expect(result.current.params.get('lat')).toBe('55.86');
    expect(result.current.params.get('lon')).toBe('-4.25');
  });

  it('lets URL filters win and leaves storage alone', async () => {
    saveNearbyPrefs({ bands: ['70cm'] });
    const before = localStorage.getItem(nearbyPrefsKey());
    const { result } = renderHook(() => useProbe(), {
      wrapper: makeWrapper(['/tools/nearby?lat=1&lon=2&b=2m']),
    });
    expect(result.current.query.bands).toEqual(['2m']);
    expect(localStorage.getItem(nearbyPrefsKey())).toBe(before);
  });

  it('writes URL and storage on change, and does not resurrect a cleared chip', async () => {
    saveNearbyPrefs({ bands: ['70cm'] });
    const { result } = renderHook(() => useProbe(), {
      wrapper: makeWrapper(['/tools/nearby?lat=1&lon=2']),
    });
    await waitFor(() => expect(result.current.params.get('b')).toBe('70cm'));

    act(() => result.current.query.toggleSource('meshtastic'));
    expect(result.current.params.get('s')).toBe('ukrepeater,library,meshtastic');
    expect(JSON.parse(localStorage.getItem(nearbyPrefsKey()) ?? '{}').sources).toContain(
      'meshtastic',
    );

    act(() => result.current.query.toggleSource('library'));
    expect(result.current.params.get('s')).toBe('ukrepeater,meshtastic');
    expect(JSON.parse(localStorage.getItem(nearbyPrefsKey()) ?? '{}')).toMatchObject({
      sources: ['ukrepeater', 'meshtastic'],
      bands: ['70cm'],
    });

    act(() => result.current.query.toggleBand('70cm'));
    expect(result.current.params.has('b')).toBe(false);
    expect(result.current.query.bands).toEqual([]);
    expect(JSON.parse(localStorage.getItem(nearbyPrefsKey()) ?? '{}').bands).toEqual([]);
  });

  it('sanitises stale stored values to defaults', async () => {
    localStorage.setItem(nearbyPrefsKey(), JSON.stringify({ sources: ['foo'], radiusKm: -3 }));
    const { result } = renderHook(() => useProbe(), {
      wrapper: makeWrapper(['/tools/nearby?lat=1&lon=2']),
    });
    expect(result.current.query.sources).toEqual([]);
    expect(result.current.query.radiusKm).toBe(DEFAULT_NEARBY_RADIUS_KM);
  });
});

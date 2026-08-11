import { act, renderHook, waitFor } from '@testing-library/react';
import { useMemo, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadTrackingDashboardPrefs,
  saveTrackingDashboardPrefs,
} from '@integrations/listPrefs/index.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { ProjectContext, type ProjectContextValue } from '../../state/ProjectContext.ts';
import { DEFAULT_WINDOW_HOURS } from './useTrackingPasses.ts';
import { useTrackingDashboardFilters } from './useTrackingDashboardFilters.ts';
import {
  DEFAULT_GLOBE_LOOK_AHEAD_MIN,
  DEFAULT_GLOBE_LOOK_BEHIND_MIN,
} from '../../components/SatelliteGlobe/orbitTrail.ts';

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

function makeProjectsWrapper(projectId: string | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const value = useMemo<ProjectContextValue>(
      () => ({
        projects: projectId ? [makeProjectMeta(projectId)] : [],
        activeProjectId: projectId,
        activeProject: projectId ? makeProjectMeta(projectId) : null,
        loading: false,
        createProject: async () => {},
        switchProject: () => {},
        renameProject: async () => {},
        deleteProject: async () => {},
        refreshProjects: async () => {},
      }),
      [],
    );

    return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
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

describe('useTrackingDashboardFilters', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts with defaults when nothing is stored', () => {
    const { result } = renderHook(() => useTrackingDashboardFilters(), {
      wrapper: makeProjectsWrapper(TEST_PROJECT_ID),
    });

    expect(result.current.windowHours).toBe(DEFAULT_WINDOW_HOURS);
    expect(result.current.drawBehindMin).toBe(0);
    expect(result.current.drawAheadMin).toBe(0);
    expect(result.current.globeLookBehindMin).toBe(DEFAULT_GLOBE_LOOK_BEHIND_MIN);
    expect(result.current.globeLookAheadMin).toBe(DEFAULT_GLOBE_LOOK_AHEAD_MIN);
    expect(result.current.minElevation).toBe('');
    expect(result.current.onlyWithFrequencies).toBe(true);
    expect(result.current.selectedSatelliteIds).toEqual(new Set());
  });

  it('hydrates from localStorage for the active project', async () => {
    saveTrackingDashboardPrefs(TEST_PROJECT_ID, {
      windowHours: 24,
      drawBehindMin: 5,
      drawAheadMin: 10,
      globeLookBehindMin: 20,
      globeLookAheadMin: 45,
      minElevation: '15',
      onlyWithFrequencies: false,
      selectedSatelliteIds: ['sat-1'],
    });

    const { result } = renderHook(() => useTrackingDashboardFilters(), {
      wrapper: makeProjectsWrapper(TEST_PROJECT_ID),
    });

    await waitFor(() => expect(result.current.windowHours).toBe(24));
    expect(result.current.drawBehindMin).toBe(5);
    expect(result.current.drawAheadMin).toBe(10);
    expect(result.current.globeLookBehindMin).toBe(20);
    expect(result.current.globeLookAheadMin).toBe(45);
    expect(result.current.minElevation).toBe('15');
    expect(result.current.onlyWithFrequencies).toBe(false);
    expect(result.current.selectedSatelliteIds).toEqual(new Set(['sat-1']));
  });

  it('persists each setter to localStorage under the active project', () => {
    const { result } = renderHook(() => useTrackingDashboardFilters(), {
      wrapper: makeProjectsWrapper(TEST_PROJECT_ID),
    });

    act(() => {
      result.current.setWindowHours(48);
      result.current.setGlobeLookBehindMin(25);
      result.current.setGlobeLookAheadMin(50);
      result.current.setMinElevation('20');
      result.current.setOnlyWithFrequencies(false);
      result.current.setSelectedSatelliteIds(new Set(['sat-2', 'sat-3']));
    });

    expect(result.current.windowHours).toBe(48);
    expect(loadTrackingDashboardPrefs(TEST_PROJECT_ID)).toEqual({
      windowHours: 48,
      globeLookBehindMin: 25,
      globeLookAheadMin: 50,
      minElevation: '20',
      onlyWithFrequencies: false,
      selectedSatelliteIds: ['sat-2', 'sat-3'],
    });
  });

  it('does not persist when there is no active project', () => {
    const { result } = renderHook(() => useTrackingDashboardFilters(), {
      wrapper: makeProjectsWrapper(null),
    });

    act(() => {
      result.current.setWindowHours(48);
    });

    expect(result.current.windowHours).toBe(48);
    expect(loadTrackingDashboardPrefs(TEST_PROJECT_ID)).toBeNull();
  });
});

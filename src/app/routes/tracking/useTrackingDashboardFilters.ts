import { useEffect, useRef, useState } from 'react';
import {
  loadTrackingDashboardPrefs,
  mergeTrackingDashboardPrefs,
} from '@integrations/listPrefs/index.ts';
import { useProjects } from '../../state/useProjects.ts';
import { DEFAULT_WINDOW_HOURS } from './useTrackingPasses.ts';
import {
  DEFAULT_GLOBE_LOOK_AHEAD_MIN,
  DEFAULT_GLOBE_LOOK_BEHIND_MIN,
} from '../../components/SatelliteGlobe/orbitTrail.ts';

export interface TrackingDashboardFilters {
  windowHours: number;
  drawBehindMin: number;
  drawAheadMin: number;
  globeLookBehindMin: number;
  globeLookAheadMin: number;
  minElevation: string;
  onlyWithFrequencies: boolean;
  selectedSatelliteIds: Set<string>;
  setWindowHours: (value: number) => void;
  setDrawBehindMin: (value: number) => void;
  setDrawAheadMin: (value: number) => void;
  setGlobeLookBehindMin: (value: number) => void;
  setGlobeLookAheadMin: (value: number) => void;
  setMinElevation: (value: string) => void;
  setOnlyWithFrequencies: (value: boolean) => void;
  setSelectedSatelliteIds: (value: Set<string>) => void;
}

/**
 * Tracking Dashboard's pass-calculation filters, persisted to localStorage per project — same
 * `listPrefs` integration (`@integrations/listPrefs`) and per-setter-persist convention as the
 * Channels list (`useChannelListQuery.ts`), minus URL-param syncing (not needed here; these
 * filters aren't meant to be shared via link the way the channel list's are).
 */
export function useTrackingDashboardFilters(): TrackingDashboardFilters {
  const { activeProjectId } = useProjects();
  const hydratedProjectId = useRef<string | null>(null);

  const [windowHours, setWindowHoursState] = useState(DEFAULT_WINDOW_HOURS);
  const [drawBehindMin, setDrawBehindMinState] = useState(0);
  const [drawAheadMin, setDrawAheadMinState] = useState(0);
  const [globeLookBehindMin, setGlobeLookBehindMinState] = useState(DEFAULT_GLOBE_LOOK_BEHIND_MIN);
  const [globeLookAheadMin, setGlobeLookAheadMinState] = useState(DEFAULT_GLOBE_LOOK_AHEAD_MIN);
  const [minElevation, setMinElevationState] = useState('');
  const [onlyWithFrequencies, setOnlyWithFrequenciesState] = useState(true);
  const [selectedSatelliteIds, setSelectedSatelliteIdsState] = useState<Set<string>>(new Set());

  // Hydrate from localStorage (an external system, not derived render state) once per project.
  // React Compiler's set-state-in-effect check flags any setState call inside an effect body on
  // principle, but reading an external store on identity change is exactly what effects are for
  // — the ref guard keeps this to one read+apply per `activeProjectId`, not a render loop.
  useEffect(() => {
    if (!activeProjectId || hydratedProjectId.current === activeProjectId) return;
    hydratedProjectId.current = activeProjectId;

    const stored = loadTrackingDashboardPrefs(activeProjectId);
    if (!stored) return;
    /* eslint-disable react-hooks/set-state-in-effect -- external localStorage read, not derived state */
    if (stored.windowHours !== undefined) setWindowHoursState(stored.windowHours);
    if (stored.drawBehindMin !== undefined) setDrawBehindMinState(stored.drawBehindMin);
    if (stored.drawAheadMin !== undefined) setDrawAheadMinState(stored.drawAheadMin);
    if (stored.globeLookBehindMin !== undefined) {
      setGlobeLookBehindMinState(stored.globeLookBehindMin);
    }
    if (stored.globeLookAheadMin !== undefined) {
      setGlobeLookAheadMinState(stored.globeLookAheadMin);
    }
    if (stored.minElevation !== undefined) setMinElevationState(stored.minElevation);
    if (stored.onlyWithFrequencies !== undefined) {
      setOnlyWithFrequenciesState(stored.onlyWithFrequencies);
    }
    if (stored.selectedSatelliteIds !== undefined) {
      setSelectedSatelliteIdsState(new Set(stored.selectedSatelliteIds));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [activeProjectId]);

  function persist(patch: Parameters<typeof mergeTrackingDashboardPrefs>[1]) {
    if (!activeProjectId) return;
    mergeTrackingDashboardPrefs(activeProjectId, patch);
  }

  return {
    windowHours,
    drawBehindMin,
    drawAheadMin,
    globeLookBehindMin,
    globeLookAheadMin,
    minElevation,
    onlyWithFrequencies,
    selectedSatelliteIds,
    setWindowHours: (value) => {
      setWindowHoursState(value);
      persist({ windowHours: value });
    },
    setDrawBehindMin: (value) => {
      setDrawBehindMinState(value);
      persist({ drawBehindMin: value });
    },
    setDrawAheadMin: (value) => {
      setDrawAheadMinState(value);
      persist({ drawAheadMin: value });
    },
    setGlobeLookBehindMin: (value) => {
      setGlobeLookBehindMinState(value);
      persist({ globeLookBehindMin: value });
    },
    setGlobeLookAheadMin: (value) => {
      setGlobeLookAheadMinState(value);
      persist({ globeLookAheadMin: value });
    },
    setMinElevation: (value) => {
      setMinElevationState(value);
      persist({ minElevation: value });
    },
    setOnlyWithFrequencies: (value) => {
      setOnlyWithFrequenciesState(value);
      persist({ onlyWithFrequencies: value });
    },
    setSelectedSatelliteIds: (value) => {
      setSelectedSatelliteIdsState(value);
      persist({ selectedSatelliteIds: Array.from(value) });
    },
  };
}

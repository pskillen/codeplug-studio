import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  loadChannelListPrefs,
  mergeChannelListPrefs,
  type ChannelListPrefs,
} from '@integrations/listPrefs/index.ts';
import {
  channelListPrefsFromSearchParams,
  channelListPrefsToSearchParams,
  hasChannelListUrlParams,
} from '../lib/listPrefs/urlSync.ts';
import { useProjects } from '../state/useProjects.ts';
import { useDebouncedNameFilter } from './useDebouncedNameFilter.ts';
import {
  defaultMaxDistanceKm,
  parseCsvParam,
  parseMaxDistanceKm,
  serializeCsvParam,
  type ChannelSortMode,
} from './channelListQueryUtils.ts';

export interface ChannelListQuery {
  nameFilter: string;
  nameFilterInput: string;
  nameFilterPending: boolean;
  sortMode: ChannelSortMode;
  bandFilter: string[];
  modeFilter: string[];
  duplexFilter: string | null;
  distanceFilterEnabled: boolean;
  maxDistanceKm: number;
  setNameFilter: (value: string) => void;
  setSortMode: (value: ChannelSortMode) => void;
  setBandFilter: (value: string[]) => void;
  setModeFilter: (value: string[]) => void;
  setDuplexFilter: (value: string | null) => void;
  setDistanceFilterEnabled: (value: boolean) => void;
  setMaxDistanceKm: (value: number) => void;
}

function setOrDelete(params: URLSearchParams, key: string, value: string | null) {
  if (value) params.set(key, value);
  else params.delete(key);
}

export function useChannelListQuery(): ChannelListQuery {
  const { activeProjectId } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const hydratedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!activeProjectId) return;

    const visitKey = `${activeProjectId}:${location.search}`;
    if (hydratedKey.current === visitKey) return;

    const currentParams = new URLSearchParams(location.search);
    if (hasChannelListUrlParams(currentParams)) {
      hydratedKey.current = visitKey;
      return;
    }

    const stored = loadChannelListPrefs(activeProjectId);
    if (stored) {
      const next = channelListPrefsToSearchParams(stored);
      if (next.toString()) {
        setSearchParams((prev) => (prev.toString() === next.toString() ? prev : next), {
          replace: true,
        });
      }
    }
    hydratedKey.current = visitKey;
  }, [activeProjectId, location.search, setSearchParams]);

  const committedNameFilter = searchParams.get('q') ?? '';
  const sortMode: ChannelSortMode = searchParams.get('sort') === 'distance' ? 'distance' : 'name';
  const bandFilter = useMemo(() => parseCsvParam(searchParams.get('band')), [searchParams]);
  const modeFilter = useMemo(() => parseCsvParam(searchParams.get('mode')), [searchParams]);
  const duplexRaw = searchParams.get('duplex');
  const duplexFilter = duplexRaw === 'simplex' || duplexRaw === 'split' ? duplexRaw : null;
  const distanceFilterEnabled = searchParams.get('distance') === '1';
  const maxDistanceKm = parseMaxDistanceKm(searchParams.get('maxKm'));

  const persistPrefs = useCallback(
    (patch: Partial<ChannelListPrefs>) => {
      if (!activeProjectId) return;
      mergeChannelListPrefs(activeProjectId, patch);
    },
    [activeProjectId],
  );

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const commitNameFilter = useCallback(
    (value: string) => {
      updateParams((p) => setOrDelete(p, 'q', value || null));
      persistPrefs({ q: value });
    },
    [updateParams, persistPrefs],
  );

  const { nameFilter, nameFilterInput, setNameFilter, nameFilterPending } = useDebouncedNameFilter(
    committedNameFilter,
    commitNameFilter,
  );

  const setSortMode = useCallback(
    (value: ChannelSortMode) => {
      updateParams((p) => setOrDelete(p, 'sort', value === 'name' ? null : value));
      persistPrefs({ sortMode: value });
    },
    [updateParams, persistPrefs],
  );

  const setBandFilter = useCallback(
    (value: string[]) => {
      updateParams((p) => setOrDelete(p, 'band', serializeCsvParam(value)));
      persistPrefs({ band: value });
    },
    [updateParams, persistPrefs],
  );

  const setModeFilter = useCallback(
    (value: string[]) => {
      updateParams((p) => setOrDelete(p, 'mode', serializeCsvParam(value)));
      persistPrefs({ mode: value });
    },
    [updateParams, persistPrefs],
  );

  const setDuplexFilter = useCallback(
    (value: string | null) => {
      updateParams((p) => setOrDelete(p, 'duplex', value));
      const duplex =
        value === 'simplex' || value === 'split' ? value : value === null ? null : undefined;
      if (duplex !== undefined) {
        persistPrefs({ duplex });
      }
    },
    [updateParams, persistPrefs],
  );

  const setDistanceFilterEnabled = useCallback(
    (value: boolean) => {
      updateParams((p) => setOrDelete(p, 'distance', value ? '1' : null));
      persistPrefs({ distanceFilterEnabled: value });
    },
    [updateParams, persistPrefs],
  );

  const setMaxDistanceKm = useCallback(
    (value: number) => {
      const km = Number.isFinite(value) ? value : defaultMaxDistanceKm();
      updateParams((p) =>
        setOrDelete(p, 'maxKm', km === defaultMaxDistanceKm() ? null : String(km)),
      );
      persistPrefs({ maxDistanceKm: km });
    },
    [updateParams, persistPrefs],
  );

  return {
    nameFilter,
    nameFilterInput,
    nameFilterPending,
    sortMode,
    bandFilter,
    modeFilter,
    duplexFilter,
    distanceFilterEnabled,
    maxDistanceKm,
    setNameFilter,
    setSortMode,
    setBandFilter,
    setModeFilter,
    setDuplexFilter,
    setDistanceFilterEnabled,
    setMaxDistanceKm,
  };
}

export { channelListPrefsFromSearchParams };

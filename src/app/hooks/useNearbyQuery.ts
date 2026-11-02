import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  loadNearbyPrefs,
  mergeNearbyPrefs,
  type NearbyPrefs,
} from '@integrations/listPrefs/index.ts';
import {
  NEARBY_FILTER_PARAM_KEYS,
  hasNearbyFilterUrlParams,
  nearbyPrefsToSearchParams,
} from '../lib/listPrefs/urlSync.ts';
import {
  parseNearbyFilters,
  type NearbySource,
  type ParsedNearbyFilters,
} from '../lib/nearbyRepeaters.ts';
import { useProjects } from '../state/useProjects.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';

export interface NearbyQuery extends ParsedNearbyFilters {
  setRadiusKm: (km: number) => void;
  toggleSource: (source: NearbySource) => void;
  toggleBand: (band: string) => void;
  toggleMode: (mode: ChannelMode) => void;
  setOperationalOnly: (value: boolean) => void;
}

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Stored prefs laid over the URL's own params (the search point `lat lon pl` is kept). */
function withStoredFilters(params: URLSearchParams, stored: NearbyPrefs): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of NEARBY_FILTER_PARAM_KEYS) next.delete(key);
  for (const [k, v] of nearbyPrefsToSearchParams(stored)) next.set(k, v);
  return next;
}

/**
 * Nearby filters (radius, sources, band/mode chips, operational): the URL is the source of truth
 * and every change is also remembered in the browser. With no filter params in the URL, the
 * remembered ones are applied once; a URL that carries any filter wins and leaves storage alone
 * until the user changes a chip. The search point is never stored.
 */
export function useNearbyQuery(): NearbyQuery {
  const { activeProjectId } = useProjects();
  const hasProject = activeProjectId != null;
  const [params, setParams] = useSearchParams();
  const [stored] = useState(() => loadNearbyPrefs());
  // Set by any chip change: from then on the URL alone is the truth (a cleared chip stays cleared).
  const [touched, setTouched] = useState(false);
  const appliedRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    if (stored && !hasNearbyFilterUrlParams(params)) {
      setParams((prev) => withStoredFilters(prev, stored), { replace: true });
    }
  }, [stored, params, setParams]);

  // Until the effect has written the URL, read the stored filters directly (no flash of defaults).
  const effective = useMemo(
    () =>
      touched || !stored || hasNearbyFilterUrlParams(params)
        ? params
        : withStoredFilters(params, stored),
    [touched, stored, params],
  );
  const filters = useMemo(
    () => parseNearbyFilters(effective, { hasProject }),
    [effective, hasProject],
  );

  const update = useCallback(
    (changes: Record<string, string | null>, prefs: Partial<NearbyPrefs>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes)) {
            if (v == null || v === '') next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
      setTouched(true);
      mergeNearbyPrefs(prefs);
    },
    [setParams],
  );

  const setRadiusKm = useCallback(
    (km: number) => update({ r: String(Math.round(km * 100) / 100) }, { radiusKm: km }),
    [update],
  );
  const toggleSource = useCallback(
    (source: NearbySource) => {
      const next = toggle(filters.sources, source);
      update({ s: next.join(',') || 'none' }, { sources: next });
    },
    [filters.sources, update],
  );
  const toggleBand = useCallback(
    (band: string) => {
      const next = toggle(filters.bands, band);
      update({ b: next.join(',') }, { bands: next });
    },
    [filters.bands, update],
  );
  const toggleMode = useCallback(
    (mode: ChannelMode) => {
      const next = toggle(filters.modes, mode);
      update({ m: next.join(',') }, { modes: next });
    },
    [filters.modes, update],
  );
  const setOperationalOnly = useCallback(
    (value: boolean) => update({ op: value ? '1' : null }, { operationalOnly: value }),
    [update],
  );

  return { ...filters, setRadiusKm, toggleSource, toggleBand, toggleMode, setOperationalOnly };
}

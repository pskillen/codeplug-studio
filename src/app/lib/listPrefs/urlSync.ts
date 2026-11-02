import {
  defaultMaxDistanceKm,
  parseCsvParam,
  parseMaxDistanceKm,
  serializeCsvParam,
  type ChannelSortMode,
} from '../../hooks/channelListQueryUtils.ts';
import type {
  ChannelListPrefs,
  EntityListPrefs,
  NearbyPrefs,
} from '@integrations/listPrefs/index.ts';

const CHANNEL_LIST_PARAM_KEYS = [
  'q',
  'sort',
  'band',
  'mode',
  'duplex',
  'zone',
  'distance',
  'maxKm',
] as const;

export function hasChannelListUrlParams(params: URLSearchParams): boolean {
  return CHANNEL_LIST_PARAM_KEYS.some((key) => params.has(key));
}

export function hasEntityListUrlParams(params: URLSearchParams): boolean {
  return params.has('q');
}

export function channelListPrefsFromSearchParams(params: URLSearchParams): ChannelListPrefs {
  const sortMode: ChannelSortMode = params.get('sort') === 'distance' ? 'distance' : 'name';
  const duplexRaw = params.get('duplex');
  const duplexFilter = duplexRaw === 'simplex' || duplexRaw === 'split' ? duplexRaw : null;

  return {
    q: params.get('q') ?? '',
    sortMode,
    band: parseCsvParam(params.get('band')),
    mode: parseCsvParam(params.get('mode')),
    duplex: duplexFilter,
    zone: parseCsvParam(params.get('zone')),
    distanceFilterEnabled: params.get('distance') === '1',
    maxDistanceKm: parseMaxDistanceKm(params.get('maxKm')),
  };
}

function setOrDelete(params: URLSearchParams, key: string, value: string | null) {
  if (value) params.set(key, value);
  else params.delete(key);
}

export function channelListPrefsToSearchParams(prefs: ChannelListPrefs): URLSearchParams {
  const params = new URLSearchParams();
  setOrDelete(params, 'q', prefs.q || null);
  setOrDelete(params, 'sort', prefs.sortMode === 'distance' ? 'distance' : null);
  setOrDelete(params, 'band', serializeCsvParam(prefs.band ?? []));
  setOrDelete(params, 'mode', serializeCsvParam(prefs.mode ?? []));
  setOrDelete(params, 'duplex', prefs.duplex ?? null);
  setOrDelete(params, 'zone', serializeCsvParam(prefs.zone ?? []));
  setOrDelete(params, 'distance', prefs.distanceFilterEnabled ? '1' : null);
  const maxKm = prefs.maxDistanceKm ?? defaultMaxDistanceKm();
  setOrDelete(params, 'maxKm', maxKm === defaultMaxDistanceKm() ? null : String(maxKm));
  return params;
}

/** Nearby filter params. `lat lon pl` (the search point) are deliberately not part of the prefs. */
export const NEARBY_FILTER_PARAM_KEYS = ['r', 's', 'b', 'm', 'op'] as const;

export function hasNearbyFilterUrlParams(params: URLSearchParams): boolean {
  return NEARBY_FILTER_PARAM_KEYS.some((key) => params.has(key));
}

/** Only non-default values are emitted: `s=none` for no sources, `s` omitted when undefined. */
export function nearbyPrefsToSearchParams(prefs: NearbyPrefs): URLSearchParams {
  const params = new URLSearchParams();
  if (prefs.radiusKm != null && prefs.radiusKm > 0) {
    params.set('r', String(Math.round(prefs.radiusKm * 100) / 100));
  }
  if (prefs.sources) params.set('s', prefs.sources.join(',') || 'none');
  setOrDelete(params, 'b', serializeCsvParam(prefs.bands ?? []));
  setOrDelete(params, 'm', serializeCsvParam(prefs.modes ?? []));
  if (prefs.operationalOnly) params.set('op', '1');
  return params;
}

export function nearbyPrefsFromSearchParams(params: URLSearchParams): NearbyPrefs {
  const prefs: NearbyPrefs = {};
  const r = Number(params.get('r'));
  if (params.has('r') && Number.isFinite(r) && r > 0) prefs.radiusKm = r;
  const s = params.get('s');
  if (s != null) prefs.sources = s === 'none' ? [] : parseCsvParam(s);
  const b = parseCsvParam(params.get('b'));
  if (b.length > 0) prefs.bands = b;
  const m = parseCsvParam(params.get('m'));
  if (m.length > 0) prefs.modes = m;
  if (params.get('op') === '1') prefs.operationalOnly = true;
  return prefs;
}

export function entityListPrefsFromSearchParams(params: URLSearchParams): EntityListPrefs {
  return { q: params.get('q') ?? '' };
}

export function entityListPrefsToSearchParams(prefs: EntityListPrefs): URLSearchParams {
  const params = new URLSearchParams();
  setOrDelete(params, 'q', prefs.q || null);
  return params;
}

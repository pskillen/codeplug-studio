import {
  defaultMaxDistanceKm,
  parseCsvParam,
  parseMaxDistanceKm,
  serializeCsvParam,
  type ChannelSortMode,
} from '../../hooks/channelListQueryUtils.ts';
import type { ChannelListPrefs, EntityListPrefs } from './types.ts';

const CHANNEL_LIST_PARAM_KEYS = [
  'q',
  'sort',
  'band',
  'mode',
  'duplex',
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
  setOrDelete(params, 'distance', prefs.distanceFilterEnabled ? '1' : null);
  const maxKm = prefs.maxDistanceKm ?? defaultMaxDistanceKm();
  setOrDelete(params, 'maxKm', maxKm === defaultMaxDistanceKm() ? null : String(maxKm));
  return params;
}

export function entityListPrefsFromSearchParams(params: URLSearchParams): EntityListPrefs {
  return { q: params.get('q') ?? '' };
}

export function entityListPrefsToSearchParams(prefs: EntityListPrefs): URLSearchParams {
  const params = new URLSearchParams();
  setOrDelete(params, 'q', prefs.q || null);
  return params;
}

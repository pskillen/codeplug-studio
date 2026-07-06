export type ZonePivotKind = 'all' | 'orphans' | 'zone';

export interface ZonePivotState {
  pivot: ZonePivotKind;
  zoneId: string | null;
}

const PIVOT_PARAM = 'pivot';
const ZONE_ID_PARAM = 'zoneId';

export const DEFAULT_ZONE_PIVOT: ZonePivotState = { pivot: 'all', zoneId: null };

export function parseZonePivotSearch(search: string): ZonePivotState {
  const params = new URLSearchParams(search);
  const pivotRaw = params.get(PIVOT_PARAM);
  const zoneId = params.get(ZONE_ID_PARAM);

  if (pivotRaw === 'orphans') {
    return { pivot: 'orphans', zoneId: null };
  }
  if (pivotRaw === 'zone' && zoneId) {
    return { pivot: 'zone', zoneId };
  }
  return DEFAULT_ZONE_PIVOT;
}

export function zonePivotSearchParams(state: ZonePivotState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.pivot === 'all') {
    params.set(PIVOT_PARAM, 'all');
    return params;
  }
  if (state.pivot === 'orphans') {
    params.set(PIVOT_PARAM, 'orphans');
    return params;
  }
  if (state.pivot === 'zone' && state.zoneId) {
    params.set(PIVOT_PARAM, 'zone');
    params.set(ZONE_ID_PARAM, state.zoneId);
  }
  return params;
}

export function zonePivotPath(state: ZonePivotState): string {
  const params = zonePivotSearchParams(state);
  const query = params.toString();
  return query ? `/library/zones?${query}` : '/library/zones';
}

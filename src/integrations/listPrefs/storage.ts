import {
  channelListPrefsKey,
  entityListPrefsKey,
  nearbyPrefsKey,
  trackingDashboardPrefsKey,
} from './keys.ts';
import type {
  ChannelListPrefs,
  EntityListEntity,
  EntityListPrefs,
  NearbyPrefs,
  TrackingDashboardPrefs,
} from './types.ts';

function readJson<T>(key: string): T | null {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw === null || raw === undefined) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write failures (quota, disabled storage).
  }
}

export function loadChannelListPrefs(projectId: string): ChannelListPrefs | null {
  return readJson<ChannelListPrefs>(channelListPrefsKey(projectId));
}

export function saveChannelListPrefs(projectId: string, prefs: ChannelListPrefs): void {
  writeJson(channelListPrefsKey(projectId), prefs);
}

export function loadEntityListPrefs(
  entity: EntityListEntity,
  projectId: string,
): EntityListPrefs | null {
  return readJson<EntityListPrefs>(entityListPrefsKey(entity, projectId));
}

export function saveEntityListPrefs(
  entity: EntityListEntity,
  projectId: string,
  prefs: EntityListPrefs,
): void {
  writeJson(entityListPrefsKey(entity, projectId), prefs);
}

export function mergeChannelListPrefs(
  projectId: string,
  patch: Partial<ChannelListPrefs>,
): ChannelListPrefs {
  const current = loadChannelListPrefs(projectId) ?? {};
  const next = { ...current, ...patch };
  saveChannelListPrefs(projectId, next);
  return next;
}

export function mergeEntityListPrefs(
  entity: EntityListEntity,
  projectId: string,
  patch: Partial<EntityListPrefs>,
): EntityListPrefs {
  const current = loadEntityListPrefs(entity, projectId) ?? {};
  const next = { ...current, ...patch };
  saveEntityListPrefs(entity, projectId, next);
  return next;
}

export function loadTrackingDashboardPrefs(projectId: string): TrackingDashboardPrefs | null {
  return readJson<TrackingDashboardPrefs>(trackingDashboardPrefsKey(projectId));
}

export function saveTrackingDashboardPrefs(projectId: string, prefs: TrackingDashboardPrefs): void {
  writeJson(trackingDashboardPrefsKey(projectId), prefs);
}

function stringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;
}

/** Structural clean-up of stored Nearby prefs (types only; value validation is the app's job). */
export function sanitizeNearbyPrefs(raw: unknown): NearbyPrefs | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const out: NearbyPrefs = {};
  if (typeof r.radiusKm === 'number' && Number.isFinite(r.radiusKm) && r.radiusKm > 0) {
    out.radiusKm = r.radiusKm;
  }
  const sources = stringArray(r.sources);
  if (sources) out.sources = sources;
  const bands = stringArray(r.bands);
  if (bands) out.bands = bands;
  const modes = stringArray(r.modes);
  if (modes) out.modes = modes;
  if (typeof r.operationalOnly === 'boolean') out.operationalOnly = r.operationalOnly;
  return out;
}

export function loadNearbyPrefs(): NearbyPrefs | null {
  return sanitizeNearbyPrefs(readJson<unknown>(nearbyPrefsKey()));
}

export function saveNearbyPrefs(prefs: NearbyPrefs): void {
  writeJson(nearbyPrefsKey(), prefs);
}

export function mergeNearbyPrefs(patch: Partial<NearbyPrefs>): NearbyPrefs {
  const current = loadNearbyPrefs() ?? {};
  const next = { ...current, ...patch };
  saveNearbyPrefs(next);
  return next;
}

export function mergeTrackingDashboardPrefs(
  projectId: string,
  patch: Partial<TrackingDashboardPrefs>,
): TrackingDashboardPrefs {
  const current = loadTrackingDashboardPrefs(projectId) ?? {};
  const next = { ...current, ...patch };
  saveTrackingDashboardPrefs(projectId, next);
  return next;
}

import { channelListPrefsKey, entityListPrefsKey } from './keys.ts';
import type { ChannelListPrefs, EntityListEntity, EntityListPrefs } from './types.ts';

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

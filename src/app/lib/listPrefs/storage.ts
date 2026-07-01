import { channelListPrefsKey, entityListPrefsKey } from './keys.ts';
import type { ChannelListPrefs, EntityListEntity, EntityListPrefs } from './types.ts';

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 300;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
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

export function debouncedMergeChannelListPrefs(
  projectId: string,
  patch: Partial<ChannelListPrefs>,
): void {
  const key = channelListPrefsKey(projectId);
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      mergeChannelListPrefs(projectId, patch);
    }, DEBOUNCE_MS),
  );
}

export function debouncedMergeEntityListPrefs(
  entity: EntityListEntity,
  projectId: string,
  patch: Partial<EntityListPrefs>,
): void {
  const key = entityListPrefsKey(entity, projectId);
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      mergeEntityListPrefs(entity, projectId, patch);
    }, DEBOUNCE_MS),
  );
}

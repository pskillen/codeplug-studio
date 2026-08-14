import { channelListLayoutPrefsKey } from './keys.ts';
import type { ChannelListLayoutPrefs } from './types.ts';

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

export function loadChannelListLayoutPrefs(projectId: string): ChannelListLayoutPrefs | null {
  return readJson<ChannelListLayoutPrefs>(channelListLayoutPrefsKey(projectId));
}

export function saveChannelListLayoutPrefs(
  projectId: string,
  prefs: ChannelListLayoutPrefs,
): void {
  writeJson(channelListLayoutPrefsKey(projectId), prefs);
}

export function mergeChannelListLayoutPrefs(
  projectId: string,
  patch: Partial<ChannelListLayoutPrefs>,
): ChannelListLayoutPrefs {
  const current = loadChannelListLayoutPrefs(projectId) ?? {};
  const next = { ...current, ...patch };
  saveChannelListLayoutPrefs(projectId, next);
  return next;
}

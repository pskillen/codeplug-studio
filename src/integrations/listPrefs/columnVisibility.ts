import { channelListColumnsKey, channelListColumnsSchemaKey } from './keys.ts';

function readRaw(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function readStorageRaw(key: string): string | null {
  return readRaw(key);
}

export function loadStringArray(storageKey: string, validKeys: Set<string>, fallback: string[]): string[] {
  try {
    const raw = readRaw(storageKey);
    if (raw !== null) {
      return (JSON.parse(raw) as string[]).filter((k) => validKeys.has(k));
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveStringArray(storageKey: string, values: string[]): void {
  try {
    globalThis.localStorage?.setItem(storageKey, JSON.stringify(values));
  } catch {
    // Ignore write failures.
  }
}

export function loadChannelVisibleColumns(
  projectId: string,
  validKeys: Set<string>,
  defaultColumns: string[],
  schemaVersion: number,
): string[] {
  const storageKey = channelListColumnsKey(projectId);
  const schemaKey = channelListColumnsSchemaKey(projectId);

  const cols = loadStringArray(storageKey, validKeys, defaultColumns);

  try {
    const schema = Number.parseInt(readRaw(schemaKey) ?? '0', 10);
    if (schema < schemaVersion) {
      saveStringArray(storageKey, cols);
      globalThis.localStorage?.setItem(schemaKey, String(schemaVersion));
    }
  } catch {
    /* ignore */
  }

  return cols;
}

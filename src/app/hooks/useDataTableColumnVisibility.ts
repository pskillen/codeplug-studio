import { useCallback, useSyncExternalStore } from 'react';
import { loadStringArray, readStorageRaw, saveStringArray } from '@integrations/listPrefs/index.ts';

export interface ColumnVisibilityDef {
  key: string;
  header: string;
  defaultVisible?: boolean;
}

function defaultVisibleKeys(defs: ColumnVisibilityDef[]): string[] {
  return defs.filter((d) => d.defaultVisible !== false).map((d) => d.key);
}

const EMPTY_VISIBILITY: string[] = [];
const disabledSnapshotCache = new Map<string, string[]>();

function disabledSnapshotCacheKey(storageKey: string, defs: ColumnVisibilityDef[]): string {
  return `${storageKey}\0${defs.map((d) => `${d.key}:${d.defaultVisible === false ? 0 : 1}`).join(',')}`;
}

function getDisabledSnapshot(storageKey: string, defs: ColumnVisibilityDef[]): string[] {
  if (defs.length === 0) return EMPTY_VISIBILITY;
  const cacheKey = disabledSnapshotCacheKey(storageKey, defs);
  let snap = disabledSnapshotCache.get(cacheKey);
  if (!snap) {
    snap = defaultVisibleKeys(defs);
    disabledSnapshotCache.set(cacheKey, snap);
  }
  return snap;
}

function loadFromStorage(storageKey: string, defs: ColumnVisibilityDef[]): string[] {
  const validKeys = new Set(defs.map((d) => d.key));
  return loadStringArray(storageKey, validKeys, defaultVisibleKeys(defs));
}

const stores = new Map<
  string,
  {
    listeners: Set<() => void>;
    cachedSnapshot: string[] | null;
    cachedStorageValue: string | null | undefined;
    defs: ColumnVisibilityDef[];
    customLoad?: () => string[];
  }
>();

function getStore(storageKey: string, defs: ColumnVisibilityDef[], customLoad?: () => string[]) {
  let store = stores.get(storageKey);
  if (!store) {
    store = {
      listeners: new Set(),
      cachedSnapshot: null,
      cachedStorageValue: undefined,
      defs,
      customLoad,
    };
    stores.set(storageKey, store);
  }
  store.defs = defs;
  store.customLoad = customLoad;
  return store;
}

function readStorageValue(storageKey: string): string | null {
  return readStorageRaw(storageKey);
}

function getSnapshot(
  storageKey: string,
  defs: ColumnVisibilityDef[],
  customLoad?: () => string[],
): string[] {
  const store = getStore(storageKey, defs, customLoad);

  if (customLoad) {
    const raw = readStorageValue(storageKey);
    if (store.cachedSnapshot && raw === store.cachedStorageValue) {
      return store.cachedSnapshot;
    }
    const next = customLoad();
    store.cachedStorageValue = readStorageValue(storageKey);
    store.cachedSnapshot = next;
    return store.cachedSnapshot;
  }

  const raw = readStorageValue(storageKey);
  if (store.cachedSnapshot && raw === store.cachedStorageValue) {
    return store.cachedSnapshot;
  }
  store.cachedStorageValue = raw;
  store.cachedSnapshot = loadFromStorage(storageKey, defs);
  return store.cachedSnapshot;
}

function emitChange(storageKey: string) {
  const store = stores.get(storageKey);
  if (!store) return;
  store.cachedSnapshot = null;
  store.cachedStorageValue = undefined;
  for (const listener of store.listeners) listener();
}

export function useDataTableColumnVisibility(
  storageKey: string,
  defs: ColumnVisibilityDef[],
  options?: { load?: () => string[]; enabled?: boolean },
): [string[], (cols: string[]) => void] {
  const customLoad = options?.load;
  const enabled = options?.enabled !== false;

  const visibleCols = useSyncExternalStore(
    (listener) => {
      if (!enabled) return () => {};
      const store = getStore(storageKey, defs, customLoad);
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () =>
      enabled ? getSnapshot(storageKey, defs, customLoad) : getDisabledSnapshot(storageKey, defs),
    () =>
      enabled ? getSnapshot(storageKey, defs, customLoad) : getDisabledSnapshot(storageKey, defs),
  );

  const setVisibleCols = useCallback(
    (cols: string[]) => {
      if (!enabled) return;
      saveStringArray(storageKey, cols);
      emitChange(storageKey);
    },
    [storageKey, enabled],
  );

  return [visibleCols, setVisibleCols];
}

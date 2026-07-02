import {
  LIST_ENTITY_LABELS,
  LIST_PREFS_STORAGE_PREFIX,
} from '@integrations/listPrefs/index.ts';
import {
  ACTIVE_PROJECT_KEY,
  MAPBOX_TOKEN_KEY,
  PREFERENCES_STORAGE_PREFIX,
} from '@integrations/preferences/index.ts';
import { parseStorageRaw, redactParsedValue } from './parseStorageValue.ts';

export { LIST_PREFS_STORAGE_PREFIX };

export interface StorageKeyDescriptor {
  key: string;
  label: string;
  redact: boolean;
}

export interface StorageKeyRow extends StorageKeyDescriptor {
  present: boolean;
  byteSize: number;
}

export interface StorageEntry {
  raw: string | null;
  parsed: unknown;
  parseError: string | null;
  present: boolean;
}

const KNOWN_STORAGE_KEYS: StorageKeyDescriptor[] = [
  { key: ACTIVE_PROJECT_KEY, label: 'Active project id', redact: false },
  { key: MAPBOX_TOKEN_KEY, label: 'Mapbox token', redact: true },
];

export function formatByteSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function storageKeyViewerPath(key: string): string {
  return `/debug/local-storage/${encodeURIComponent(key)}`;
}

export function decodeStorageKeyParam(param: string): string {
  return decodeURIComponent(param);
}

function describeListPrefsKey(key: string): string | null {
  if (!key.startsWith(LIST_PREFS_STORAGE_PREFIX)) return null;
  const rest = key.slice(LIST_PREFS_STORAGE_PREFIX.length);
  const parts = rest.split('.');
  const entity = parts[0];
  if (!entity || !LIST_ENTITY_LABELS[entity]) return 'List prefs';

  if (parts.length === 2) {
    return `List prefs (${LIST_ENTITY_LABELS[entity]})`;
  }
  if (parts.length === 3 && parts[2] === 'columns') {
    return `List columns (${LIST_ENTITY_LABELS[entity]})`;
  }
  if (parts.length === 3 && parts[2] === 'columns-schema') {
    return `List columns schema (${LIST_ENTITY_LABELS[entity]})`;
  }
  return `List prefs (${LIST_ENTITY_LABELS[entity]})`;
}

function describePreferencesKey(key: string): string | null {
  if (!key.startsWith(PREFERENCES_STORAGE_PREFIX)) return null;
  if (key === ACTIVE_PROJECT_KEY || key === MAPBOX_TOKEN_KEY) return null;
  return 'Preferences (unknown)';
}

export function getStorageKeyDescriptor(key: string): StorageKeyDescriptor {
  const known = KNOWN_STORAGE_KEYS.find((entry) => entry.key === key);
  if (known) return known;
  const listLabel = describeListPrefsKey(key);
  if (listLabel) return { key, label: listLabel, redact: false };
  const prefsLabel = describePreferencesKey(key);
  if (prefsLabel) return { key, label: prefsLabel, redact: false };
  return { key, label: 'Unknown key', redact: false };
}

function isStudioStorageKey(key: string): boolean {
  return key.startsWith(PREFERENCES_STORAGE_PREFIX) || key.startsWith(LIST_PREFS_STORAGE_PREFIX);
}

export function listStorageKeys(): StorageKeyRow[] {
  const knownKeySet = new Set(KNOWN_STORAGE_KEYS.map((entry) => entry.key));
  const seenKeys = new Set<string>();
  const rows: StorageKeyRow[] = KNOWN_STORAGE_KEYS.map((descriptor) => {
    seenKeys.add(descriptor.key);
    const raw = localStorage.getItem(descriptor.key);
    return {
      ...descriptor,
      present: raw !== null,
      byteSize: raw?.length ?? 0,
    };
  });

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || knownKeySet.has(key) || seenKeys.has(key) || !isStudioStorageKey(key)) continue;
    seenKeys.add(key);
    const raw = localStorage.getItem(key);
    rows.push({
      ...getStorageKeyDescriptor(key),
      present: raw !== null,
      byteSize: raw?.length ?? 0,
    });
  }

  return rows;
}

export function readStorageEntry(descriptor: StorageKeyDescriptor): StorageEntry {
  const raw = localStorage.getItem(descriptor.key);
  const present = raw !== null;
  const { parsed, parseError } = parseStorageRaw(raw);
  const viewParsed =
    parsed !== null && parseError === null ? redactParsedValue(parsed, descriptor.redact) : parsed;

  return {
    raw,
    parsed: viewParsed,
    parseError,
    present,
  };
}

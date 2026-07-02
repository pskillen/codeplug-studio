import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVE_PROJECT_KEY, MAPBOX_TOKEN_KEY } from '@integrations/preferences/index.ts';
import { DRIVE_ACCESS_TOKEN_KEY } from '@integrations/cloud/drivePrefs.ts';
import {
  decodeStorageKeyParam,
  formatByteSize,
  listStorageKeys,
  readStorageEntry,
  storageKeyViewerPath,
} from './storageKeyRegistry.ts';

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe('storageKeyRegistry', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('formatByteSize renders human-readable sizes', () => {
    expect(formatByteSize(0)).toBe('0 B');
    expect(formatByteSize(512)).toBe('512 B');
    expect(formatByteSize(2048)).toBe('2.0 KB');
  });

  it('storageKeyViewerPath encodes keys for routes', () => {
    expect(storageKeyViewerPath(ACTIVE_PROJECT_KEY)).toBe(
      `/debug/local-storage/${encodeURIComponent(ACTIVE_PROJECT_KEY)}`,
    );
    expect(decodeStorageKeyParam(encodeURIComponent(ACTIVE_PROJECT_KEY))).toBe(ACTIVE_PROJECT_KEY);
  });

  it('listStorageKeys labels list prefs keys by entity', () => {
    localStorage.setItem('mm9pdy-codeplug-studio.list.channels.proj-1', '{}');
    localStorage.setItem('mm9pdy-codeplug-studio.list.zones.proj-1', '{}');
    localStorage.setItem('mm9pdy-codeplug-studio.list.extra.proj-1', '1');
    const rows = listStorageKeys();
    expect(
      rows.find((row) => row.key === 'mm9pdy-codeplug-studio.list.channels.proj-1')?.label,
    ).toBe('List prefs (channels)');
    expect(rows.find((row) => row.key === 'mm9pdy-codeplug-studio.list.zones.proj-1')?.label).toBe(
      'List prefs (zones)',
    );
    expect(rows.find((row) => row.key === 'mm9pdy-codeplug-studio.list.extra.proj-1')?.label).toBe(
      'List prefs',
    );
  });

  it('listStorageKeys includes known keys and studio-prefix extras', () => {
    localStorage.setItem('codeplug-studio:futureKey', '1');
    const rows = listStorageKeys();
    expect(rows.some((row) => row.key === ACTIVE_PROJECT_KEY)).toBe(true);
    expect(rows.some((row) => row.key === 'codeplug-studio:futureKey')).toBe(true);
    expect(rows.find((row) => row.key === 'codeplug-studio:futureKey')?.label).toBe(
      'Preferences (unknown)',
    );
  });

  it('readStorageEntry redacts mapbox token values', () => {
    localStorage.setItem(MAPBOX_TOKEN_KEY, 'pk.super-secret-token');
    const entry = readStorageEntry({
      key: MAPBOX_TOKEN_KEY,
      label: 'Mapbox token',
      redact: true,
    });
    expect(entry.present).toBe(true);
    expect(entry.parsed).toEqual({ value: '••••oken' });
  });

  it('readStorageEntry redacts google drive access token', () => {
    localStorage.setItem(DRIVE_ACCESS_TOKEN_KEY, 'ya29.super-secret-token');
    const entry = readStorageEntry({
      key: DRIVE_ACCESS_TOKEN_KEY,
      label: 'Google Drive access token',
      redact: true,
    });
    expect(entry.parsed).toEqual({ value: '••••oken' });
  });

  it('readStorageEntry parses active project id JSON', () => {
    localStorage.setItem(ACTIVE_PROJECT_KEY, 'project-abc');
    const entry = readStorageEntry({
      key: ACTIVE_PROJECT_KEY,
      label: 'Active project id',
      redact: false,
    });
    expect(entry.parseError).toBeNull();
    expect(entry.parsed).toEqual({ value: 'project-abc' });
  });
});

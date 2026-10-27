import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';
import { putCacheBytes, type AtD890DownloadCache } from './memory.ts';
import {
  MM9PDY_SETTINGS_STORE_LENGTH,
  MM9PDY_STORE_NXDN_UNLOCK_OFFSET,
  isAtD890Mm9pdyNxdnEnabled,
  isMm9pdyNxdnEnabledInRecord,
  isMm9pdySettingsStoreValid,
} from './mm9pdySettingsStore.ts';

function record(over: { unlock?: number; version?: number; fixSum?: boolean } = {}): Uint8Array {
  const r = new Uint8Array(MM9PDY_SETTINGS_STORE_LENGTH);
  r[0] = 0x4d;
  r[1] = 0x36;
  r[2] = over.version ?? 1;
  r[MM9PDY_STORE_NXDN_UNLOCK_OFFSET] = over.unlock ?? 0;
  if (over.fixSum !== false) {
    let sum = 0;
    for (let i = 0; i < 31; i++) sum = (sum + r[i]!) & 0xff;
    r[31] = sum;
  }
  return r;
}

function cacheWith(rec: Uint8Array | null): AtD890DownloadCache {
  const cache: AtD890DownloadCache = { blocks: new Map() };
  const store = new Uint8Array(D890_MAP.SettingsStoreLength).fill(0xff);
  if (rec) store.set(rec, 0);
  putCacheBytes(cache, D890_MAP.SettingsStore, store);
  return cache;
}

describe('MM9PDY settings store NXDN gate', () => {
  it('is on only for a valid record with nxdn_unlock = 1', () => {
    expect(isMm9pdyNxdnEnabledInRecord(record({ unlock: 1 }))).toBe(true);
    expect(isAtD890Mm9pdyNxdnEnabled(cacheWith(record({ unlock: 1 })))).toBe(true);
  });

  it('is off when nxdn_unlock is 0 or any other value', () => {
    expect(isMm9pdyNxdnEnabledInRecord(record({ unlock: 0 }))).toBe(false);
    expect(isMm9pdyNxdnEnabledInRecord(record({ unlock: 2 }))).toBe(false);
    expect(isMm9pdyNxdnEnabledInRecord(record({ unlock: 0xff }))).toBe(false);
  });

  it('is off when the sum is wrong', () => {
    expect(isMm9pdySettingsStoreValid(record({ unlock: 1, fixSum: false }))).toBe(false);
    expect(isMm9pdyNxdnEnabledInRecord(record({ unlock: 1, fixSum: false }))).toBe(false);
    const bad = record({ unlock: 1 });
    bad[31] = (bad[31]! + 1) & 0xff;
    expect(isMm9pdyNxdnEnabledInRecord(bad)).toBe(false);
  });

  it('is off when the magic is wrong', () => {
    const r = record({ unlock: 1 });
    r[1] = 0x35;
    expect(isMm9pdyNxdnEnabledInRecord(r)).toBe(false);
  });

  it('is off for an unknown version', () => {
    expect(isMm9pdyNxdnEnabledInRecord(record({ unlock: 1, version: 2 }))).toBe(false);
    expect(isMm9pdyNxdnEnabledInRecord(record({ unlock: 1, version: 0 }))).toBe(false);
  });

  it('is off for a short record and for a blank (0xff) store', () => {
    expect(isMm9pdyNxdnEnabledInRecord(record({ unlock: 1 }).subarray(0, 31))).toBe(false);
    expect(isAtD890Mm9pdyNxdnEnabled(cacheWith(null))).toBe(false);
  });

  it('is off with no cache or a cache without the store block', () => {
    expect(isAtD890Mm9pdyNxdnEnabled(null)).toBe(false);
    expect(isAtD890Mm9pdyNxdnEnabled(undefined)).toBe(false);
    expect(isAtD890Mm9pdyNxdnEnabled({ blocks: new Map() })).toBe(false);
  });

  it('reads the record at 0x03500200', () => {
    expect(D890_MAP.SettingsStore).toBe(0x0350_0200);
  });
});

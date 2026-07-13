import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BRANDMEISTER_CACHE_PREFIX,
  clearDirectoryCache,
  DIRECTORY_CACHE_TTL_MS,
  directoryCacheKey,
  ETCC_CACHE_PREFIX,
  readDirectoryCache,
  readStaleDirectoryCache,
  REPEATERBOOK_CACHE_PREFIX,
  writeDirectoryCache,
} from './sessionCache.ts';

function createSessionStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('sessionCache', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', createSessionStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null on cache miss', () => {
    expect(readDirectoryCache('etcc-api:https://example.test')).toBeNull();
  });

  it('reads and writes within TTL', () => {
    const key = directoryCacheKey(ETCC_CACHE_PREFIX, 'https://api-beta.rsgb.online/callsign/gb3da');
    writeDirectoryCache(key, '{"data":[]}');
    expect(readDirectoryCache(key)).toBe('{"data":[]}');
  });

  it('expires entries after TTL', () => {
    vi.useFakeTimers();
    const key = directoryCacheKey(
      BRANDMEISTER_CACHE_PREFIX,
      'https://api.brandmeister.network/v2/device/byCall',
    );
    writeDirectoryCache(key, '[]');
    vi.advanceTimersByTime(DIRECTORY_CACHE_TTL_MS + 1);
    expect(readDirectoryCache(key)).toBeNull();
    vi.useRealTimers();
  });

  it('readStaleDirectoryCache returns expired body', () => {
    vi.useFakeTimers();
    const key = directoryCacheKey(
      REPEATERBOOK_CACHE_PREFIX,
      '/api/repeaterbook/export',
      'rbuapp_t',
    );
    writeDirectoryCache(key, '{"results":[]}');
    vi.advanceTimersByTime(DIRECTORY_CACHE_TTL_MS + 1);
    expect(readStaleDirectoryCache(key)).toBe('{"results":[]}');
    vi.useRealTimers();
  });

  it('isolates keys by provider prefix', () => {
    const url = 'https://example.test/path';
    writeDirectoryCache(directoryCacheKey(ETCC_CACHE_PREFIX, url), 'etcc');
    writeDirectoryCache(directoryCacheKey(BRANDMEISTER_CACHE_PREFIX, url), 'bm');
    expect(readDirectoryCache(directoryCacheKey(ETCC_CACHE_PREFIX, url))).toBe('etcc');
    expect(readDirectoryCache(directoryCacheKey(BRANDMEISTER_CACHE_PREFIX, url))).toBe('bm');
  });

  it('includes token suffix in RepeaterBook cache key', () => {
    const url = '/api/repeaterbook/export?region=na';
    const keyA = directoryCacheKey(REPEATERBOOK_CACHE_PREFIX, url, 'rbuapp_a');
    const keyB = directoryCacheKey(REPEATERBOOK_CACHE_PREFIX, url, 'rbuapp_b');
    writeDirectoryCache(keyA, 'token-a');
    expect(readDirectoryCache(keyA)).toBe('token-a');
    expect(readDirectoryCache(keyB)).toBeNull();
  });

  it('clearDirectoryCache removes only matching prefix', () => {
    writeDirectoryCache(directoryCacheKey(ETCC_CACHE_PREFIX, 'a'), '1');
    writeDirectoryCache(directoryCacheKey(REPEATERBOOK_CACHE_PREFIX, 'b'), '2');
    clearDirectoryCache(REPEATERBOOK_CACHE_PREFIX);
    expect(readDirectoryCache(directoryCacheKey(ETCC_CACHE_PREFIX, 'a'))).toBe('1');
    expect(readDirectoryCache(directoryCacheKey(REPEATERBOOK_CACHE_PREFIX, 'b'))).toBeNull();
  });

  it('swallows sessionStorage write errors', () => {
    vi.stubGlobal('sessionStorage', {
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
      getItem: () => null,
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      get length() {
        return 0;
      },
    });
    expect(() => writeDirectoryCache('etcc-api:test', 'body')).not.toThrow();
    expect(readDirectoryCache('etcc-api:test')).toBeNull();
  });
});

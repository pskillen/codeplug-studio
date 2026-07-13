import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDirectoryText } from './directoryFetch.ts';
import { clearRateLimitState } from './rateLimit.ts';
import { BRANDMEISTER_CACHE_PREFIX, clearDirectoryCache } from './sessionCache.ts';
import { RepeaterDirectoryError } from './types.ts';

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

describe('directoryFetch', () => {
  const url = 'https://api.brandmeister.network/v2/device/byCall?callsign=GB7AC';

  beforeEach(() => {
    vi.stubGlobal('sessionStorage', createSessionStorageMock());
    clearDirectoryCache();
    clearRateLimitState();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearDirectoryCache();
    clearRateLimitState();
  });

  it('returns cached body without calling fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchDirectoryText(url, {
      provider: 'brandmeister',
      cachePrefix: BRANDMEISTER_CACHE_PREFIX,
      networkErrorMessage: 'network',
    });

    const second = await fetchDirectoryText(url, {
      provider: 'brandmeister',
      cachePrefix: BRANDMEISTER_CACHE_PREFIX,
      networkErrorMessage: 'network',
    });

    expect(second.fromCache).toBe(true);
    expect(second.body).toBe('[]');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves stale cache on 429 when prior entry exists', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(new Response('[{"id":1}]', { status: 200 }))
        .mockResolvedValueOnce(new Response('rate limited', { status: 429 })),
    );

    await fetchDirectoryText(url, {
      provider: 'brandmeister',
      cachePrefix: BRANDMEISTER_CACHE_PREFIX,
      networkErrorMessage: 'network',
    });

    const { DIRECTORY_CACHE_TTL_MS } = await import('./sessionCache.ts');
    vi.advanceTimersByTime(DIRECTORY_CACHE_TTL_MS + 1);

    const result = await fetchDirectoryText(url, {
      provider: 'brandmeister',
      cachePrefix: BRANDMEISTER_CACHE_PREFIX,
      networkErrorMessage: 'network',
    });

    expect(result.stale).toBe(true);
    expect(result.body).toBe('[{"id":1}]');
    vi.useRealTimers();
  });

  it('throws on 429 without stale cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));

    await expect(
      fetchDirectoryText(url, {
        provider: 'brandmeister',
        cachePrefix: BRANDMEISTER_CACHE_PREFIX,
        networkErrorMessage: 'network',
      }),
    ).rejects.toThrow(RepeaterDirectoryError);
  });

  it('blocks fetch when provider is in cooldown', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));

    await expect(
      fetchDirectoryText(url, {
        provider: 'brandmeister',
        cachePrefix: BRANDMEISTER_CACHE_PREFIX,
        networkErrorMessage: 'network',
      }),
    ).rejects.toThrow(RepeaterDirectoryError);

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchDirectoryText(url, {
        provider: 'brandmeister',
        cachePrefix: BRANDMEISTER_CACHE_PREFIX,
        networkErrorMessage: 'network',
      }),
    ).rejects.toThrow(RepeaterDirectoryError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('honours Retry-After for cooldown duration', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T12:00:00Z'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 429, headers: { 'Retry-After': '5' } })),
    );

    await expect(
      fetchDirectoryText(url, {
        provider: 'brandmeister',
        cachePrefix: BRANDMEISTER_CACHE_PREFIX,
        networkErrorMessage: 'network',
      }),
    ).rejects.toThrow(RepeaterDirectoryError);

    vi.advanceTimersByTime(4_999);
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchDirectoryText(url, {
        provider: 'brandmeister',
        cachePrefix: BRANDMEISTER_CACHE_PREFIX,
        networkErrorMessage: 'network',
      }),
    ).rejects.toThrow(RepeaterDirectoryError);

    vi.advanceTimersByTime(2);
    await fetchDirectoryText(url, {
      provider: 'brandmeister',
      cachePrefix: BRANDMEISTER_CACHE_PREFIX,
      networkErrorMessage: 'network',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

import { vi } from 'vitest';
import { clearRateLimitState } from './rateLimit.ts';
import { clearDirectoryCache } from './sessionCache.ts';

export function createSessionStorageMock(): Storage {
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

export function setupRepeaterDirectoryTestMocks(): void {
  vi.stubGlobal('sessionStorage', createSessionStorageMock());
  clearDirectoryCache();
  clearRateLimitState();
}

export function teardownRepeaterDirectoryTestMocks(): void {
  vi.unstubAllGlobals();
  clearDirectoryCache();
  clearRateLimitState();
}

export function mockJsonFetch(status: number, body: unknown): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

export function mockTextFetch(status: number, body: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status })),
  );
}

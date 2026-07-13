import { vi } from 'vitest';
import { clearRateLimitState } from './rateLimit.ts';
import { clearIntegrationCache } from './sessionCache.ts';

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

export function setupIntegrationHttpTestMocks(): void {
  vi.stubGlobal('sessionStorage', createSessionStorageMock());
  clearIntegrationCache();
  clearRateLimitState();
}

export function teardownIntegrationHttpTestMocks(): void {
  vi.unstubAllGlobals();
  clearIntegrationCache();
  clearRateLimitState();
}

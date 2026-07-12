import { REPEATERBOOK_SESSION_CACHE_TTL_MS } from './constants.ts';

interface CacheEntry {
  body: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Clear in-memory RepeaterBook cache (tests). */
export function clearRepeaterBookSessionCache(): void {
  cache.clear();
}

export function readRepeaterBookSessionCache(key: string): string | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.body;
}

export function writeRepeaterBookSessionCache(key: string, body: string): void {
  cache.set(key, {
    body,
    expiresAt: Date.now() + REPEATERBOOK_SESSION_CACHE_TTL_MS,
  });
}

export function repeaterBookCacheKey(url: string, tokenPrefix: string): string {
  return `${tokenPrefix}:${url}`;
}

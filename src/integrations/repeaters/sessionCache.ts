/** Session-scoped TTL for repeater directory HTTP response bodies (ms). */
export const DIRECTORY_CACHE_TTL_MS = 5 * 60 * 1000;

export const ETCC_CACHE_PREFIX = 'etcc-api:';
export const BRANDMEISTER_CACHE_PREFIX = 'bm-api:';
export const REPEATERBOOK_CACHE_PREFIX = 'rb-api:';
export const IRTS_CACHE_PREFIX = 'irts-api:';

interface CacheEntry {
  body: string;
  expiresAt: number;
}

function readEntry(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

export function directoryCacheKey(prefix: string, url: string, suffix?: string): string {
  const base = `${prefix}${url}`;
  if (suffix?.trim()) return `${base}:${suffix.trim()}`;
  return base;
}

/** Read a fresh (non-expired) cached response body, or null. */
export function readDirectoryCache(key: string): string | null {
  const entry = readEntry(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) return null;
  return entry.body;
}

/** Read cached body even when past TTL — for 429 stale fallback. Does not delete. */
export function readStaleDirectoryCache(key: string): string | null {
  const entry = readEntry(key);
  return entry?.body ?? null;
}

export function writeDirectoryCache(
  key: string,
  body: string,
  ttlMs = DIRECTORY_CACHE_TTL_MS,
): void {
  try {
    const entry: CacheEntry = { body, expiresAt: Date.now() + ttlMs };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // sessionStorage full or unavailable — degrade to uncached fetch
  }
}

/** Clear cached entries; optional prefix filter (e.g. `rb-api:`). */
export function clearDirectoryCache(prefix?: string): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (!prefix || key.startsWith(prefix))) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** @deprecated Use clearDirectoryCache(REPEATERBOOK_CACHE_PREFIX) */
export function clearRepeaterBookSessionCache(): void {
  clearDirectoryCache(REPEATERBOOK_CACHE_PREFIX);
}

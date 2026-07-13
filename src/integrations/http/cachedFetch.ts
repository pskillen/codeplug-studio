import { assertNotRateLimited, parseRetryAfterMs, recordRateLimit } from './rateLimit.ts';
import {
  integrationCacheKey,
  readIntegrationCache,
  readStaleIntegrationCache,
  writeIntegrationCache,
} from './sessionCache.ts';

export interface CachedFetchOptions {
  provider: string;
  cachePrefix: string;
  cacheKeySuffix?: string;
  init?: RequestInit;
  /** Bypass read/write cache (e.g. forced refresh). */
  skipCache?: boolean;
  networkErrorMessage: string;
  rateLimitMessage: string;
  createError: (message: string, status?: number) => Error;
  /** Treat non-429 error responses as rate limits (provider-specific). */
  isRateLimitResponse?: (status: number, body: string) => boolean;
}

export interface CachedFetchResult {
  body: string;
  status: number;
  headers: Headers;
  fromCache: boolean;
  stale?: boolean;
}

export async function fetchCachedText(
  url: string,
  options: CachedFetchOptions,
): Promise<CachedFetchResult> {
  const {
    provider,
    cachePrefix,
    cacheKeySuffix,
    init,
    skipCache = false,
    networkErrorMessage,
    rateLimitMessage,
    createError,
    isRateLimitResponse,
  } = options;

  assertNotRateLimited(provider, rateLimitMessage, createError);

  const cacheKey = integrationCacheKey(cachePrefix, url, cacheKeySuffix);

  if (!skipCache) {
    const cached = readIntegrationCache(cacheKey);
    if (cached != null) {
      return { body: cached, status: 200, headers: new Headers(), fromCache: true };
    }
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw createError(networkErrorMessage);
  }

  const body = await response.text();

  const rateLimited =
    response.status === 429 || (isRateLimitResponse?.(response.status, body) ?? false);

  if (rateLimited) {
    recordRateLimit(provider, parseRetryAfterMs(response.headers.get('Retry-After')));
    const stale = readStaleIntegrationCache(cacheKey);
    if (stale != null) {
      return {
        body: stale,
        status: 200,
        headers: new Headers(),
        fromCache: true,
        stale: true,
      };
    }
    throw createError(rateLimitMessage, 429);
  }

  if (!skipCache && response.ok) {
    writeIntegrationCache(cacheKey, body);
  }

  return {
    body,
    status: response.status,
    headers: response.headers,
    fromCache: false,
  };
}

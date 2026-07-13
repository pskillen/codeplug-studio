import {
  assertNotRateLimited,
  parseRetryAfterMs,
  rateLimitMessage,
  recordRateLimit,
  type DirectoryProvider,
} from './rateLimit.ts';
import {
  directoryCacheKey,
  readDirectoryCache,
  readStaleDirectoryCache,
  writeDirectoryCache,
} from './sessionCache.ts';
import { RepeaterDirectoryError } from './types.ts';

export interface DirectoryFetchOptions {
  provider: DirectoryProvider;
  cachePrefix: string;
  cacheKeySuffix?: string;
  init?: RequestInit;
  /** Bypass read/write cache (e.g. IRTS refresh). */
  skipCache?: boolean;
  networkErrorMessage: string;
  /** Treat non-429 error responses as rate limits (e.g. JSON `rate_limited`). */
  isRateLimitResponse?: (status: number, body: string) => boolean;
}

export interface DirectoryFetchResult {
  body: string;
  status: number;
  headers: Headers;
  fromCache: boolean;
  stale?: boolean;
}

export async function fetchDirectoryText(
  url: string,
  options: DirectoryFetchOptions,
): Promise<DirectoryFetchResult> {
  const {
    provider,
    cachePrefix,
    cacheKeySuffix,
    init,
    skipCache = false,
    networkErrorMessage,
    isRateLimitResponse,
  } = options;

  assertNotRateLimited(provider);

  const cacheKey = directoryCacheKey(cachePrefix, url, cacheKeySuffix);

  if (!skipCache) {
    const cached = readDirectoryCache(cacheKey);
    if (cached != null) {
      return { body: cached, status: 200, headers: new Headers(), fromCache: true };
    }
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new RepeaterDirectoryError(networkErrorMessage);
  }

  const body = await response.text();

  const rateLimited =
    response.status === 429 || (isRateLimitResponse?.(response.status, body) ?? false);

  if (rateLimited) {
    recordRateLimit(provider, parseRetryAfterMs(response.headers.get('Retry-After')));
    const stale = readStaleDirectoryCache(cacheKey);
    if (stale != null) {
      return {
        body: stale,
        status: 200,
        headers: new Headers(),
        fromCache: true,
        stale: true,
      };
    }
    throw new RepeaterDirectoryError(rateLimitMessage(provider), 429);
  }

  if (!skipCache && response.ok) {
    writeDirectoryCache(cacheKey, body);
  }

  return {
    body,
    status: response.status,
    headers: response.headers,
    fromCache: false,
  };
}

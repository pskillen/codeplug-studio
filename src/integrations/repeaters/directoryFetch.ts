import { fetchCachedText } from '../http/cachedFetch.ts';
import { rateLimitMessage, type DirectoryProvider } from './rateLimit.ts';
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

export type DirectoryFetchResult = Awaited<ReturnType<typeof fetchCachedText>>;

export async function fetchDirectoryText(
  url: string,
  options: DirectoryFetchOptions,
): Promise<DirectoryFetchResult> {
  const { provider, ...rest } = options;
  return fetchCachedText(url, {
    ...rest,
    provider,
    rateLimitMessage: rateLimitMessage(provider),
    createError: (message, status) => new RepeaterDirectoryError(message, status),
  });
}

import { fetchCachedText } from '../http/cachedFetch.ts';
import { rateLimitMessage, type SatelliteRateLimitProvider } from './rateLimit.ts';
import { SatelliteDirectoryError } from './types.ts';

export interface DirectoryFetchOptions {
  provider: SatelliteRateLimitProvider;
  cachePrefix: string;
  cacheKeySuffix?: string;
  init?: RequestInit;
  /** Bypass read/write cache (e.g. explicit refresh). */
  skipCache?: boolean;
  networkErrorMessage: string;
}

export type DirectoryFetchResult = Awaited<ReturnType<typeof fetchCachedText>>;

export async function fetchSatelliteDirectoryText(
  url: string,
  options: DirectoryFetchOptions,
): Promise<DirectoryFetchResult> {
  const { provider, ...rest } = options;
  return fetchCachedText(url, {
    ...rest,
    provider,
    rateLimitMessage: rateLimitMessage(provider),
    createError: (message, status) => new SatelliteDirectoryError(message, status),
  });
}

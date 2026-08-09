import { resolveApiUrl } from '../platform/resolveApiUrl.ts';
import { fetchSatelliteDirectoryText } from './directoryFetch.ts';
import { CELESTRAK_CACHE_PREFIX } from './sessionCache.ts';
import { SatelliteDirectoryError } from './types.ts';

export const CELESTRAK_AMATEUR_API_PATH = '/api/celestrak/amateur';

/** Fetch the raw CelesTrak amateur-satellite TLE feed as text. */
export async function fetchCelestrakAmateurTle(options?: { refresh?: boolean }): Promise<string> {
  const url = resolveApiUrl(CELESTRAK_AMATEUR_API_PATH);
  const { body, status } = await fetchSatelliteDirectoryText(url, {
    provider: 'celestrak',
    cachePrefix: CELESTRAK_CACHE_PREFIX,
    skipCache: options?.refresh === true,
    networkErrorMessage: 'Could not reach CelesTrak — check your network connection.',
  });

  if (status < 200 || status >= 300) {
    throw new SatelliteDirectoryError(`CelesTrak returned ${status}.`, status);
  }

  return body;
}

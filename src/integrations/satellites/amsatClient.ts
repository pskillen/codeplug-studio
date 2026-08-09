import { resolveApiUrl } from '../platform/resolveApiUrl.ts';
import { fetchSatelliteDirectoryText } from './directoryFetch.ts';
import { AMSAT_CACHE_PREFIX } from './sessionCache.ts';
import { SatelliteDirectoryError } from './types.ts';

export const AMSAT_NASABARE_API_PATH = '/api/amsat/nasabare';

/** Fetch the raw AMSAT current amateur-satellite TLE feed as text. */
export async function fetchAmsatNasabareTle(options?: { refresh?: boolean }): Promise<string> {
  const url = resolveApiUrl(AMSAT_NASABARE_API_PATH);
  const { body, status } = await fetchSatelliteDirectoryText(url, {
    provider: 'amsat',
    cachePrefix: AMSAT_CACHE_PREFIX,
    skipCache: options?.refresh === true,
    networkErrorMessage: 'Could not reach AMSAT — check your network connection.',
  });

  if (status < 200 || status >= 300) {
    throw new SatelliteDirectoryError(`AMSAT returned ${status}.`, status);
  }

  return body;
}

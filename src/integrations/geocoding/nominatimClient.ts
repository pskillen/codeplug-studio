import { resolveApiUrl } from '../platform/resolveApiUrl.ts';
import { fetchCachedText } from '../http/cachedFetch.ts';
import { NOMINATIM_CACHE_PREFIX } from '../http/sessionCache.ts';
import { NOMINATIM_SEARCH_PROXY_PATH } from './nominatimConstants.ts';

const NOMINATIM_PROVIDER = 'nominatim';
const NOMINATIM_RESULT_LIMIT = 5;
const NOMINATIM_NETWORK_ERROR_MESSAGE =
  'Could not reach address search — check your network connection.';
const NOMINATIM_RATE_LIMIT_MESSAGE = 'Address search rate limit — wait before searching again.';

export class NominatimSearchError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'NominatimSearchError';
    this.status = status;
  }
}

export interface NominatimSearchResult {
  lat: number;
  lon: number;
  /** Nominatim's `display_name` — a full human-readable address string. */
  displayName: string;
}

interface NominatimApiResult {
  lat?: string;
  lon?: string;
  display_name?: string;
}

function parseResults(body: string): NominatimSearchResult[] {
  let rows: NominatimApiResult[];
  try {
    rows = JSON.parse(body) as NominatimApiResult[];
  } catch {
    throw new NominatimSearchError('Address search returned an unexpected response.');
  }
  if (!Array.isArray(rows)) return [];

  const results: NominatimSearchResult[] = [];
  for (const row of rows) {
    const lat = row.lat != null ? Number.parseFloat(row.lat) : NaN;
    const lon = row.lon != null ? Number.parseFloat(row.lon) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    results.push({ lat, lon, displayName: row.display_name?.trim() || `${lat}, ${lon}` });
  }
  return results;
}

/**
 * Search for an address/place via the Studio Nominatim proxy. Only the search term itself
 * (and a Studio-side result-count cap) is sent — no operator or project data is bundled
 * into the query. Caller is responsible for debouncing (Nominatim's usage policy caps
 * requests at 1/s); this function issues one request per call.
 */
export async function searchNominatim(query: string): Promise<NominatimSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const params = new URLSearchParams({ q: trimmed, limit: String(NOMINATIM_RESULT_LIMIT) });
  const url = `${resolveApiUrl(NOMINATIM_SEARCH_PROXY_PATH)}?${params.toString()}`;

  const { body, status } = await fetchCachedText(url, {
    provider: NOMINATIM_PROVIDER,
    cachePrefix: NOMINATIM_CACHE_PREFIX,
    networkErrorMessage: NOMINATIM_NETWORK_ERROR_MESSAGE,
    rateLimitMessage: NOMINATIM_RATE_LIMIT_MESSAGE,
    createError: (message, errStatus) => new NominatimSearchError(message, errStatus),
  });

  if (status < 200 || status >= 300) {
    throw new NominatimSearchError(`Address search failed (${status}).`, status);
  }

  return parseResults(body);
}

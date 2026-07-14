import { fetchCachedText } from '../http/cachedFetch.ts';
import {
  RADIOID_CACHE_PREFIX,
  RADIOID_DMR_USER_PROXY_PATH,
  RADIOID_MAX_PER_PAGE,
  RADIOID_NETWORK_ERROR_MESSAGE,
  RADIOID_PROVIDER,
  RADIOID_RATE_LIMIT_MESSAGE,
} from './constants.ts';
import { RadioidDirectoryError } from './errors.ts';
import type {
  RadioidDmrUserListing,
  RadioidDmrUserSearchParams,
  RadioidDmrUserSearchResult,
} from './types.ts';

interface RadioidApiUserRow {
  id?: number;
  radio_id?: number;
  callsign?: string;
  fname?: string;
  surname?: string;
  name?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface RadioidApiResponse {
  count?: number;
  page?: number;
  pages?: number;
  per_page?: number;
  results?: RadioidApiUserRow[];
}

function normaliseListing(row: RadioidApiUserRow): RadioidDmrUserListing | null {
  const id = row.id ?? row.radio_id;
  if (typeof id !== 'number' || !Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    callsign: row.callsign?.trim() ?? '',
    fname: row.fname?.trim() ?? '',
    surname: row.surname?.trim() ?? '',
    name: row.name?.trim() ?? '',
    city: row.city?.trim() ?? '',
    state: row.state?.trim() ?? '',
    country: row.country?.trim() ?? '',
  };
}

function buildSearchUrl(params: RadioidDmrUserSearchParams): string {
  const search = new URLSearchParams();
  const entries: [keyof RadioidDmrUserSearchParams, string | number | undefined][] = [
    ['id', params.id],
    ['id_sel', params.id_sel],
    ['callsign', params.callsign],
    ['callsign_sel', params.callsign_sel],
    ['city', params.city],
    ['city_sel', params.city_sel],
    ['state', params.state],
    ['state_sel', params.state_sel],
    ['country', params.country],
    ['country_sel', params.country_sel],
    ['page', params.page],
    ['per_page', params.per_page],
  ];
  for (const [key, value] of entries) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${RADIOID_DMR_USER_PROXY_PATH}?${query}` : RADIOID_DMR_USER_PROXY_PATH;
}

export async function searchRadioidDmrUsers(
  params: RadioidDmrUserSearchParams,
): Promise<RadioidDmrUserSearchResult> {
  const perPage = Math.min(params.per_page ?? RADIOID_MAX_PER_PAGE, RADIOID_MAX_PER_PAGE);
  const url = buildSearchUrl({ ...params, per_page: perPage });

  const { body, status } = await fetchCachedText(url, {
    provider: RADIOID_PROVIDER,
    cachePrefix: RADIOID_CACHE_PREFIX,
    networkErrorMessage: RADIOID_NETWORK_ERROR_MESSAGE,
    rateLimitMessage: RADIOID_RATE_LIMIT_MESSAGE,
    createError: (message, errorStatus) => new RadioidDirectoryError(message, errorStatus),
  });

  if (status < 200 || status >= 300) {
    throw new RadioidDirectoryError(`RadioID.net returned ${status}.`, status);
  }

  let parsed: RadioidApiResponse;
  try {
    parsed = JSON.parse(body) as RadioidApiResponse;
  } catch {
    throw new RadioidDirectoryError('Invalid response from RadioID.net.');
  }

  const listings = (parsed.results ?? [])
    .map(normaliseListing)
    .filter((row): row is RadioidDmrUserListing => row != null);

  return {
    listings,
    count: parsed.count ?? listings.length,
    page: parsed.page ?? params.page ?? 1,
    pages: parsed.pages ?? 1,
    perPage: parsed.per_page ?? perPage,
  };
}

import type { ChannelMode } from '@core/models/libraryTypes.ts';
import type { ListingGeometryFilter } from '../ukrepeater/queryRouter.ts';
import { RepeaterDirectoryError, type RepeaterListing } from '../types.ts';
import { isRepeaterBookOperational } from './modeMapping.ts';
import {
  buildRepeaterBookExportUrl,
  fetchRepeaterBookExport,
  searchRepeaterBookByCallsign,
  searchRepeaterBookByCallsignAnyRegion,
} from './repeaterbookClient.ts';

export type RepeaterBookRegion = 'na' | 'row';

export interface RepeaterBookSearchParams {
  region: RepeaterBookRegion;
  token: string;
  callsign?: string;
  stateId?: string;
  country?: string;
}

export interface RepeaterBookSearchFilters {
  operationalOnly?: boolean;
  bands?: string[];
  geometry?: ListingGeometryFilter;
  modes?: ChannelMode[];
}

function listingIsSimplex(listing: RepeaterListing): boolean {
  const { rxFrequencyHz, txFrequencyHz } = listing;
  if (rxFrequencyHz == null || txFrequencyHz == null) return false;
  return rxFrequencyHz === txFrequencyHz;
}

export function filterRepeaterBookListings(
  listings: RepeaterListing[],
  filters: RepeaterBookSearchFilters = {},
): RepeaterListing[] {
  let result = listings;
  if (filters.operationalOnly) {
    result = result.filter((l) => isRepeaterBookOperational(l.status));
  }
  if (filters.bands?.length) {
    const wanted = new Set(filters.bands.map((band) => band.trim().toUpperCase()).filter(Boolean));
    result = result.filter((l) => wanted.has(l.band.toUpperCase()));
  }
  if (filters.geometry === 'simplex') {
    result = result.filter(listingIsSimplex);
  } else if (filters.geometry === 'split') {
    result = result.filter((l) => !listingIsSimplex(l));
  }
  if (filters.modes?.length) {
    const wanted = new Set(filters.modes);
    result = result.filter((l) => l.modes.some((m) => wanted.has(m)));
  }
  return result;
}

function buildQueryParams(params: RepeaterBookSearchParams): Record<string, string> {
  const query: Record<string, string> = {};
  if (params.callsign?.trim()) query.callsign = params.callsign.trim();
  if (params.region === 'na') {
    if (params.stateId?.trim()) query.state_id = params.stateId.trim();
    if (params.country?.trim()) query.country = params.country.trim();
  } else if (params.country?.trim()) {
    query.country = params.country.trim();
  }
  return query;
}

export async function searchRepeaterBook(
  params: RepeaterBookSearchParams,
  filters: RepeaterBookSearchFilters = {},
): Promise<RepeaterListing[]> {
  const query = buildQueryParams(params);
  if (!Object.keys(query).length) {
    throw new RepeaterDirectoryError(
      'Enter a callsign, state ID (NA), or country to search RepeaterBook.',
    );
  }
  const url = buildRepeaterBookExportUrl(params.region, query);
  const listings = await fetchRepeaterBookExport(url, params.token);
  return filterRepeaterBookListings(listings, filters);
}

export { searchRepeaterBookByCallsign, searchRepeaterBookByCallsignAnyRegion };

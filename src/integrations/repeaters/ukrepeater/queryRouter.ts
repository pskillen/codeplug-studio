import { coordsToLocator, isValidLocator } from '@core/domain/maidenhead.ts';
import { geocodeQuery, type GeocodeProvider } from '@integrations/geocode/index.ts';
import type { RepeaterListing } from '../types.ts';
import {
  searchUkRepeatersByBand,
  searchUkRepeatersByCallsign,
  searchUkRepeatersByLocator,
} from '../ukRepeaterClient.ts';

export type QueryKind = 'callsign' | 'locator' | 'band' | 'town';

const BAND_TOKENS = new Set(['2m', '4m', '6m', '10m', '23cm', '70cm', '13cm', '3cm', '9cm', '40m']);

/** UK-style callsign — must include at least one digit (avoids town names like Derby). */
const CALLSIGN_RE = /^[A-Z0-9][A-Z0-9/-]{1,11}$/i;

function looksLikeCallsign(query: string): boolean {
  const compact = query.trim().replace(/\s/g, '');
  if (!CALLSIGN_RE.test(compact)) return false;
  return /\d/.test(compact);
}

export interface QueryRouteResult {
  kind: QueryKind;
  listings: RepeaterListing[];
}

export interface SearchFilters {
  operationalOnly?: boolean;
  townSubstring?: string;
  band?: string;
}

export function detectQueryKind(query: string): QueryKind {
  const trimmed = query.trim();
  if (!trimmed) return 'town';
  if (isValidLocator(trimmed)) return 'locator';
  const lower = trimmed.toLowerCase();
  if (BAND_TOKENS.has(lower)) return 'band';
  if (looksLikeCallsign(trimmed)) return 'callsign';
  return 'town';
}

export function filterListings(
  listings: RepeaterListing[],
  filters: SearchFilters = {},
): RepeaterListing[] {
  let result = listings;
  if (filters.operationalOnly) {
    result = result.filter((l) => l.status.toUpperCase() === 'OPERATIONAL');
  }
  if (filters.band?.trim()) {
    const band = filters.band.trim().toUpperCase();
    result = result.filter((l) => l.band.toUpperCase() === band);
  }
  if (filters.townSubstring?.trim()) {
    const needle = filters.townSubstring.trim().toUpperCase();
    result = result.filter((l) => (l.name ?? '').toUpperCase().includes(needle));
  }
  return result;
}

export async function routeQuery(
  query: string,
  opts?: { geocodeProvider?: GeocodeProvider; mapboxToken?: string },
): Promise<QueryRouteResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { kind: 'town', listings: [] };
  }

  const kind = detectQueryKind(trimmed);

  if (kind === 'callsign') {
    return { kind, listings: await searchUkRepeatersByCallsign(trimmed) };
  }
  if (kind === 'locator') {
    return { kind, listings: await searchUkRepeatersByLocator(trimmed) };
  }
  if (kind === 'band') {
    return { kind, listings: await searchUkRepeatersByBand(trimmed) };
  }

  const geo = await geocodeQuery(trimmed, {
    provider: opts?.geocodeProvider,
    mapboxToken: opts?.mapboxToken,
  });
  if (!geo) {
    return { kind: 'town', listings: [] };
  }
  const locator = coordsToLocator(geo.lat, geo.lon, 4);
  const listings = await searchUkRepeatersByLocator(locator);
  return { kind: 'town', listings };
}

export async function searchUkRepeaters(
  query: string,
  filters: SearchFilters = {},
  opts?: { geocodeProvider?: GeocodeProvider; mapboxToken?: string },
): Promise<{ kind: QueryKind; listings: RepeaterListing[] }> {
  const { kind, listings } = await routeQuery(query, opts);
  const townNeedle = kind === 'town' ? query.trim() : filters.townSubstring;
  return {
    kind,
    listings: filterListings(listings, { ...filters, townSubstring: townNeedle }),
  };
}

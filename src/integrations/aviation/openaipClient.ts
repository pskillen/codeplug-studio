import type { AirportListing } from './types.ts';
import { AviationDirectoryError } from './types.ts';
import { openAipFrequencyTypeLabel, parseOpenAipFrequencyMhz } from './openaip/frequencyTypes.ts';

const OPENAIP_API_BASE = 'https://api.core.openaip.net';
const DEFAULT_PAGE_LIMIT = 100;
const MAX_PAGES = 10;

interface OpenAipFrequencyWire {
  value: string;
  type: number;
  name?: string;
  primary?: boolean;
  remarks?: string;
}

interface OpenAipAirportWire {
  _id: string;
  name: string;
  icaoCode?: string | null;
  iataCode?: string | null;
  type?: number | null;
  elevation?: { value?: number; unit?: number } | number | null;
  geometry?: {
    type: 'Point';
    coordinates: [number, number];
  } | null;
  frequencies?: OpenAipFrequencyWire[];
}

interface OpenAipListResponse {
  items: OpenAipAirportWire[];
  totalCount: number;
  totalPages: number;
  page: number;
  nextPage?: number;
}

function elevationMetres(elevation: OpenAipAirportWire['elevation']): number | null {
  if (elevation == null) return null;
  if (typeof elevation === 'number') return elevation;
  const value = elevation.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function locationFromGeometry(
  geometry: OpenAipAirportWire['geometry'],
): { lat: number; lon: number } | null {
  const coords = geometry?.coordinates;
  if (!coords || coords.length < 2) return null;
  const [lon, lat] = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

export function normaliseOpenAipAirport(wire: OpenAipAirportWire): AirportListing {
  const frequencies = (wire.frequencies ?? [])
    .map((freq) => {
      const rxFrequencyHz = parseOpenAipFrequencyMhz(freq.value);
      if (rxFrequencyHz == null) return null;
      return {
        service: openAipFrequencyTypeLabel(freq.type, freq.name),
        rxFrequencyHz,
        remarks: freq.remarks?.trim() || undefined,
        primary: freq.primary,
      };
    })
    .filter((freq): freq is NonNullable<typeof freq> => freq != null);

  return {
    openAipId: wire._id,
    name: wire.name?.trim() || wire.icaoCode?.trim() || 'Unknown airport',
    icao: wire.icaoCode?.trim().toUpperCase() || null,
    iata: wire.iataCode?.trim().toUpperCase() || null,
    elevationM: elevationMetres(wire.elevation),
    airportType: wire.type ?? null,
    location: locationFromGeometry(wire.geometry),
    frequencies,
    source: 'openaip',
  };
}

async function fetchOpenAipPage(
  apiKey: string,
  params: Record<string, string>,
): Promise<OpenAipListResponse> {
  const url = new URL(`${OPENAIP_API_BASE}/api/airports`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        'x-openaip-api-key': apiKey,
        Accept: 'application/json',
      },
    });
  } catch {
    throw new AviationDirectoryError('Could not reach OpenAIP — check your network connection.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new AviationDirectoryError(
      'OpenAIP rejected the API key — check Settings.',
      response.status,
    );
  }
  if (!response.ok) {
    throw new AviationDirectoryError(`OpenAIP returned ${response.status}.`, response.status);
  }

  let parsed: OpenAipListResponse;
  try {
    parsed = (await response.json()) as OpenAipListResponse;
  } catch {
    throw new AviationDirectoryError('Invalid response from OpenAIP.');
  }

  return parsed;
}

async function fetchAllOpenAipAirports(
  apiKey: string,
  params: Record<string, string>,
): Promise<AirportListing[]> {
  const airports: AirportListing[] = [];
  let page = 1;

  for (let i = 0; i < MAX_PAGES; i++) {
    const response = await fetchOpenAipPage(apiKey, {
      ...params,
      page: String(page),
      limit: String(DEFAULT_PAGE_LIMIT),
    });
    airports.push(...(response.items ?? []).map(normaliseOpenAipAirport));
    if (!response.nextPage || page >= response.totalPages) break;
    page = response.nextPage;
  }

  return airports;
}

/** Search airports near a position. `pos` is `lat,lon` per OpenAIP API. */
export function searchOpenAipAirportsNear(
  apiKey: string,
  lat: number,
  lon: number,
  radiusMetres: number,
): Promise<AirportListing[]> {
  return fetchAllOpenAipAirports(apiKey, {
    pos: `${lat},${lon}`,
    dist: String(Math.max(1, Math.round(radiusMetres))),
  });
}

/** Text search — ICAO, IATA, airport name. */
export function searchOpenAipAirportsByText(
  apiKey: string,
  search: string,
): Promise<AirportListing[]> {
  return fetchAllOpenAipAirports(apiKey, {
    search: search.trim(),
    searchOptLwc: 'true',
  });
}

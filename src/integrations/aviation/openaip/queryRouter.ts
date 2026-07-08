import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import { geocodeQuery, type GeocodeProvider } from '@integrations/geocode/index.ts';
import { searchOpenAipAirportsByText, searchOpenAipAirportsNear } from '../openaipClient.ts';
import type { AirportListing, AirportQueryKind, AirportSearchResult } from '../types.ts';
import { AviationDirectoryError } from '../types.ts';

const ICAO_RE = /^[A-Z]{4}$/i;
const IATA_RE = /^[A-Z]{3}$/i;

export function detectAirportQueryKind(query: string): AirportQueryKind {
  const trimmed = query.trim();
  if (!trimmed) return 'name';
  if (ICAO_RE.test(trimmed)) return 'icao';
  if (IATA_RE.test(trimmed)) return 'iata';
  if (isValidLocator(trimmed)) return 'locator';
  return 'town';
}

export interface RouteAirportQueryOptions {
  apiKey: string;
  radiusKm?: number;
  geocodeProvider?: GeocodeProvider;
  mapboxToken?: string;
  /** Direct coordinates from “use my location”. */
  coords?: { lat: number; lon: number };
}

function requireApiKey(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new AviationDirectoryError('OpenAIP API key is not configured — add one in Settings.');
  }
  return trimmed;
}

async function airportsNearCoords(
  apiKey: string,
  lat: number,
  lon: number,
  radiusKm: number,
): Promise<AirportSearchResult> {
  const radiusMetres = Math.max(1, Math.round(radiusKm * 1000));
  const airports = await searchOpenAipAirportsNear(apiKey, lat, lon, radiusMetres);
  return {
    kind: 'coords',
    airports,
    referencePoint: { lat, lon },
  };
}

export async function routeAirportQuery(
  query: string,
  options: RouteAirportQueryOptions,
): Promise<AirportSearchResult> {
  const apiKey = requireApiKey(options.apiKey);
  const radiusKm = options.radiusKm ?? 50;

  if (options.coords) {
    return airportsNearCoords(apiKey, options.coords.lat, options.coords.lon, radiusKm);
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return { kind: 'name', airports: [] };
  }

  const kind = detectAirportQueryKind(trimmed);

  if (kind === 'icao' || kind === 'iata' || kind === 'name') {
    const airports = await searchOpenAipAirportsByText(apiKey, trimmed);
    return { kind, airports };
  }

  if (kind === 'locator') {
    const coords = locatorToCoords(trimmed);
    if (!coords) {
      return { kind, airports: [] };
    }
    return {
      ...(await airportsNearCoords(apiKey, coords.lat, coords.lon, radiusKm)),
      kind: 'locator',
    };
  }

  const geo = await geocodeQuery(trimmed, {
    provider: options.geocodeProvider,
    mapboxToken: options.mapboxToken,
  });
  if (!geo) {
    return { kind: 'town', airports: [] };
  }

  const result = await airportsNearCoords(apiKey, geo.lat, geo.lon, radiusKm);
  return { kind: 'town', airports: result.airports, referencePoint: result.referencePoint };
}

export function airportQueryKindHint(kind: AirportQueryKind | null): string | null {
  switch (kind) {
    case 'icao':
      return 'Searching by ICAO code';
    case 'iata':
      return 'Searching by IATA code';
    case 'locator':
      return 'Searching near Maidenhead locator';
    case 'town':
      return 'Searching near town / address';
    case 'coords':
      return 'Searching near your location';
    case 'name':
      return 'Searching by airport name';
    default:
      return null;
  }
}

/** Sort airports nearest-first when a reference point is known. */
export function sortAirportsByDistance(
  airports: AirportListing[],
  reference: { lat: number; lon: number },
): AirportListing[] {
  const withDistance = airports.map((airport) => ({
    airport,
    distanceKm: airport.location
      ? haversineKm(reference.lat, reference.lon, airport.location.lat, airport.location.lon)
      : Number.POSITIVE_INFINITY,
  }));
  withDistance.sort(
    (a, b) => a.distanceKm - b.distanceKm || a.airport.name.localeCompare(b.airport.name),
  );
  return withDistance.map((row) => row.airport);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export { coordsToLocator };

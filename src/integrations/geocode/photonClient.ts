import { fetchCachedText } from '@integrations/http/cachedFetch.ts';
import { PHOTON_CACHE_PREFIX } from '@integrations/http/sessionCache.ts';
import type { GeocodeResult, ReverseGeocodeResult } from './types.ts';
import { GeocodeError } from './types.ts';

const PHOTON_PROVIDER = 'photon';
const PHOTON_RATE_LIMIT_MESSAGE = 'Photon geocoding rate limit — wait before searching again.';
const PHOTON_NETWORK_ERROR = 'Could not reach Photon geocoding — check your network connection.';

async function fetchPhotonText(url: string) {
  return fetchCachedText(url, {
    provider: PHOTON_PROVIDER,
    cachePrefix: PHOTON_CACHE_PREFIX,
    networkErrorMessage: PHOTON_NETWORK_ERROR,
    rateLimitMessage: PHOTON_RATE_LIMIT_MESSAGE,
    createError: (message) => new GeocodeError(message),
  });
}

export function parsePhotonGeocodeBody(body: string, fallbackLabel: string): GeocodeResult | null {
  const data = JSON.parse(body) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: { name?: string; city?: string; country?: string };
    }[];
  };
  const feature = data.features?.[0];
  if (!feature) return null;

  const [lon, lat] = feature.geometry.coordinates;
  const { name, city, country } = feature.properties;
  const label = [name, city, country].filter(Boolean).join(', ') || fallbackLabel;
  return { lat, lon, label };
}

/** Every feature of a Photon search, labelled "name, county or state, country". */
export function parsePhotonSearchBody(body: string): GeocodeResult[] {
  const data = JSON.parse(body) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: {
        name?: string;
        county?: string;
        state?: string;
        country?: string;
        osm_value?: string;
      };
    }[];
  };
  return (data.features ?? []).map((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    const { name, county, state, country, osm_value } = feature.properties;
    const label =
      [name, county ?? state, country].filter(Boolean).join(', ') ||
      `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    const kind = osm_value?.replace(/_/g, ' ').trim();
    return kind ? { lat, lon, label, kind } : { lat, lon, label };
  });
}

export function parsePhotonReverseBody(
  body: string,
  lat: number,
  lon: number,
): ReverseGeocodeResult | null {
  const data = JSON.parse(body) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: { name?: string; city?: string; country?: string; state?: string };
    }[];
  };
  const feature = data.features?.[0];
  if (!feature) return null;

  const [featureLon, featureLat] = feature.geometry.coordinates;
  const { name, city, country, state } = feature.properties;
  const label = [name, city, state, country].filter(Boolean).join(', ') || `${lat}, ${lon}`;
  return {
    lat: featureLat,
    lon: featureLon,
    country: country?.trim() || null,
    label,
  };
}

export async function fetchPhotonGeocode(query: string): Promise<GeocodeResult | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
  const { body, status } = await fetchPhotonText(url);
  if (status < 200 || status >= 300) {
    throw new GeocodeError(`Photon geocoding failed (${status})`);
  }
  return parsePhotonGeocodeBody(body, query);
}

/** Up to `limit` Photon matches, ranked towards `near` when given. */
export async function fetchPhotonSearch(
  query: string,
  opts: { near?: { lat: number; lon: number }; limit: number },
): Promise<GeocodeResult[]> {
  const bias = opts.near
    ? `&lat=${encodeURIComponent(String(opts.near.lat))}&lon=${encodeURIComponent(String(opts.near.lon))}`
    : '';
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${opts.limit}${bias}`;
  const { body, status } = await fetchPhotonText(url);
  if (status < 200 || status >= 300) {
    throw new GeocodeError(`Photon geocoding failed (${status})`);
  }
  return parsePhotonSearchBody(body);
}

export async function fetchPhotonReverseGeocode(
  lat: number,
  lon: number,
): Promise<ReverseGeocodeResult | null> {
  const url = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&limit=1`;
  const { body, status } = await fetchPhotonText(url);
  if (status < 200 || status >= 300) {
    throw new GeocodeError(`Photon reverse geocoding failed (${status})`);
  }
  return parsePhotonReverseBody(body, lat, lon);
}

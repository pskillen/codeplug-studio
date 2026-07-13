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

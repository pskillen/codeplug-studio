import { fetchPhotonGeocode, fetchPhotonReverseGeocode } from './photonClient.ts';
import type { GeocodeProvider, GeocodeResult, ReverseGeocodeResult } from './types.ts';
import { GeocodeError } from './types.ts';

async function geocodeMapbox(query: string, token: string): Promise<GeocodeResult | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}&limit=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new GeocodeError(`Mapbox geocoding failed (${response.status})`);
  }

  const data = (await response.json()) as {
    features?: { center: [number, number]; place_name: string }[];
  };
  const feature = data.features?.[0];
  if (!feature) return null;

  const [lon, lat] = feature.center;
  return { lat, lon, label: feature.place_name };
}

async function reverseGeocodeMapbox(
  lat: number,
  lon: number,
  token: string,
): Promise<ReverseGeocodeResult | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(String(lon))},${encodeURIComponent(String(lat))}.json?access_token=${encodeURIComponent(token)}&limit=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new GeocodeError(`Mapbox reverse geocoding failed (${response.status})`);
  }

  const data = (await response.json()) as {
    features?: {
      center: [number, number];
      place_name: string;
      context?: { id?: string; text?: string }[];
    }[];
  };
  const feature = data.features?.[0];
  if (!feature) return null;

  const [featureLon, featureLat] = feature.center;
  const country =
    feature.context?.find((entry) => entry.id?.startsWith('country'))?.text?.trim() ?? null;
  return {
    lat: featureLat,
    lon: featureLon,
    country,
    label: feature.place_name,
  };
}

export async function geocodeQuery(
  query: string,
  opts?: { mapboxToken?: string; provider?: GeocodeProvider },
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new GeocodeError('Enter an address or postcode');
  }

  const provider = opts?.provider ?? (opts?.mapboxToken?.trim() ? 'mapbox' : 'photon');

  if (provider === 'mapbox') {
    const token = opts?.mapboxToken?.trim();
    if (!token) {
      throw new GeocodeError('Mapbox token required — set one in Settings');
    }
    return geocodeMapbox(trimmed, token);
  }

  return fetchPhotonGeocode(trimmed);
}

export async function reverseGeocode(
  coords: { lat: number; lon: number },
  opts?: { mapboxToken?: string; provider?: GeocodeProvider },
): Promise<ReverseGeocodeResult | null> {
  const provider = opts?.provider ?? (opts?.mapboxToken?.trim() ? 'mapbox' : 'photon');

  if (provider === 'mapbox') {
    const token = opts?.mapboxToken?.trim();
    if (!token) {
      throw new GeocodeError('Mapbox token required — set one in Settings');
    }
    return reverseGeocodeMapbox(coords.lat, coords.lon, token);
  }

  return fetchPhotonReverseGeocode(coords.lat, coords.lon);
}

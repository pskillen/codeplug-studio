export type GeocodeProvider = 'mapbox' | 'photon';

export interface GeocodeResult {
  lat: number;
  lon: number;
  label: string;
}

export interface ReverseGeocodeResult {
  lat: number;
  lon: number;
  country: string | null;
  label: string;
}

export class GeocodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GeocodeError';
  }
}

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

async function geocodePhoton(query: string): Promise<GeocodeResult | null> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new GeocodeError(`Photon geocoding failed (${response.status})`);
  }

  const data = (await response.json()) as {
    features?: {
      geometry: { coordinates: [number, number] };
      properties: { name?: string; city?: string; country?: string };
    }[];
  };
  const feature = data.features?.[0];
  if (!feature) return null;

  const [lon, lat] = feature.geometry.coordinates;
  const { name, city, country } = feature.properties;
  const label = [name, city, country].filter(Boolean).join(', ') || query;
  return { lat, lon, label };
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

  return geocodePhoton(trimmed);
}

async function reverseGeocodePhoton(
  lat: number,
  lon: number,
): Promise<ReverseGeocodeResult | null> {
  const url = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(String(lat))}&lon=${encodeURIComponent(String(lon))}&limit=1`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new GeocodeError(`Photon reverse geocoding failed (${response.status})`);
  }

  const data = (await response.json()) as {
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

  return reverseGeocodePhoton(coords.lat, coords.lon);
}

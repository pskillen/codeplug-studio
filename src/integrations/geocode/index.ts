export type GeocodeProvider = 'mapbox' | 'photon';

export interface GeocodeResult {
  lat: number;
  lon: number;
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

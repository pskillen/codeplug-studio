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

/** Normalised airport frequency from an external aviation data source. */
export interface AirportFrequency {
  /** Service label for channel naming (e.g. Tower, ATIS, Approach). */
  service: string;
  /** Receive frequency in Hz. */
  rxFrequencyHz: number;
  /** Optional remarks from the data source. */
  remarks?: string;
  /** Whether marked primary in source data. */
  primary?: boolean;
}

/** Vendor-neutral airport listing for library import workflows. */
export interface AirportListing {
  openAipId: string;
  name: string;
  icao: string | null;
  iata: string | null;
  elevationM: number | null;
  airportType: number | null;
  location: { lat: number; lon: number } | null;
  frequencies: AirportFrequency[];
  source: 'openaip';
}

export interface AirportSearchResult {
  kind: AirportQueryKind;
  airports: AirportListing[];
  /** Reference point for distance display (geographic searches). */
  referencePoint?: { lat: number; lon: number };
}

export type AirportQueryKind = 'icao' | 'iata' | 'name' | 'locator' | 'town' | 'coords';

export class AviationDirectoryError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'AviationDirectoryError';
    this.status = status;
  }
}

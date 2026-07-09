/** Minimal airport frequency input for channel generation (vendor-neutral). */
export interface AirbandFrequencyInput {
  service: string;
  rxFrequencyHz: number;
}

/** Minimal airport input for channel generation (vendor-neutral). */
export interface AirbandAirportInput {
  name: string;
  icao: string | null;
  iata: string | null;
  location: { lat: number; lon: number } | null;
  frequencies: AirbandFrequencyInput[];
}

/** Which airport label prefixes generated channel names. */
export type AirbandNamePrefixKind = 'iata' | 'icao' | 'name';

export interface AirbandGenerateOptions {
  /** Applied to every generated channel. */
  forbidTransmit?: boolean;
  power?: number | null;
  bandwidthKHz?: number;
  /** Extra literal prefix prepended to every generated name (after airport label). */
  namePrefix?: string;
  /** Airport label for channel names; defaults to IATA with ICAO/name fallback. */
  namePrefixKind?: AirbandNamePrefixKind;
  /** Include only these frequency indices; omit for all. */
  frequencyIndices?: number[];
}

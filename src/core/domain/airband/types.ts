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

export interface AirbandGenerateOptions {
  /** Applied to every generated channel. */
  forbidTransmit?: boolean;
  power?: number | null;
  bandwidthKHz?: number;
  namePrefix?: string;
  /** Include only these frequency indices; omit for all. */
  frequencyIndices?: number[];
}

import type { GeoPoint } from '@core/models/libraryTypes.ts';

export type RepeaterSource = 'ukrepeater' | 'brandmeister';
export type RepeaterMode = 'fm' | 'dmr' | 'other';

/**
 * Normalised, vendor-neutral repeater directory result. Each external client
 * maps its wire shape into this so the app + channel mapper stay source-agnostic.
 * Frequencies are in Hz; `rxFrequencyHz` is what a radio receives (the repeater
 * output), `txFrequencyHz` is what it transmits (the repeater input).
 */
export interface RepeaterListing {
  source: RepeaterSource;
  remoteId: string;
  callsign: string;
  name: string;
  rxFrequencyHz: number | null;
  txFrequencyHz: number | null;
  toneHz: number | null;
  mode: RepeaterMode;
  colourCode: number | null;
  locator: string | null;
  location: GeoPoint | null;
  band: string;
  status: string;
}

export class RepeaterDirectoryError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RepeaterDirectoryError';
    this.status = status;
  }
}

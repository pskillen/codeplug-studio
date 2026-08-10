import type { SatelliteEnrichmentSource } from './satellite.ts';

/**
 * A single SatNOGS transmitter record for a satellite. Vendor-neutral field names —
 * `mode` and `status` are passed through as free-text upstream values (SatNOGS' mode/status
 * vocabularies are open-ended), not re-encoded into a closed union here.
 */
export interface SatelliteTransmitterInfo {
  /** SatNOGS transmitter UUID — stable identity for this transmitter record. */
  uuid: string;
  description: string;
  /** e.g. 'FM', 'AFSK', 'BPSK', 'CW' — upstream free text, not a closed enum. */
  mode: string | null;
  /** Downlink centre frequency in Hz (same convention as `Satellite.downlinkHz`). */
  downlinkHz: number | null;
  /** Uplink centre frequency in Hz (same convention as `Satellite.uplinkHz`). */
  uplinkHz: number | null;
  /** Whether this transmitter is currently reported alive by the SatNOGS network. */
  alive: boolean;
  /** Upstream transmitter status, e.g. 'active' | 'inactive' | 'invalid'. */
  status: string | null;
}

/**
 * Merged SatNOGS enrichment data for one satellite, keyed by NORAD id — see
 * `SatelliteEnrichmentSource` for why this is not merged into `Satellite` itself.
 * Session-scoped: fetched and merged live, not persisted to the project document.
 */
export interface SatelliteEnrichment {
  noradId: number;
  source: SatelliteEnrichmentSource;
  transmitters: SatelliteTransmitterInfo[];
  /** ISO 8601 timestamp this enrichment record was last fetched/merged. */
  fetchedAt: string;
}

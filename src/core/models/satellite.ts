import type { PersistableRow } from './revision.ts';
import type { SatelliteTransmitter } from './satelliteTransmitter.ts';

/** Upstream TLE source a satellite row was last refreshed from. */
export type SatelliteSource = 'celestrak' | 'amsat';

/**
 * Upstream **enrichment** source for transmitter/mode/operational-status data — a distinct
 * question from `SatelliteSource` above (where a satellite's TLE came from). A satellite
 * whose transmitter data was merged from SatNOGS does not have a TLE from SatNOGS, so this
 * is kept as a sibling type rather than folded into `SatelliteSource`. Fetched and merged
 * live per session (see `src/integrations/satellites/mergeSatelliteEnrichment.ts`) — not
 * persisted as part of the `Satellite` shape.
 */
export type SatelliteEnrichmentSource = 'satnogs';

/**
 * Vendor-neutral satellite orbital record. `tleLine1`/`tleLine2` are the
 * persisted source of truth for propagation (satellite.js re-derives a
 * `satrec` from the raw lines) — the decoded fields below are for display
 * only and must never be re-encoded back into TLE lines.
 */
export interface Satellite extends PersistableRow {
  name: string;
  noradId: number;
  enabled: boolean;
  source: SatelliteSource;

  /** Raw TLE data lines (69 chars each) — propagation source of truth. */
  tleLine1: string;
  tleLine2: string;

  /** ISO 8601 timestamp the element set is valid at. */
  epoch: string;
  classification: string;
  inclinationDeg: number;
  raanDeg: number;
  eccentricity: number;
  argPerigeeDeg: number;
  meanAnomalyDeg: number;
  meanMotionRevPerDay: number;
  bstar: number;
  elementSetNumber: number;
  revolutionNumber: number;

  /**
   * Onboard transmitters/transponders/beacons — vendor-neutral, no radio-specific caps or
   * NORAD allowlists. Always an array; `[]` when nothing is known. Radio write-packing of
   * these fields is out of scope here (#855–#859).
   */
  transmitters: SatelliteTransmitter[];
}

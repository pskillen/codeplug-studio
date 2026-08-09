import type { PersistableRow } from './revision.ts';

/** Upstream TLE source a satellite row was last refreshed from. */
export type SatelliteSource = 'celestrak' | 'amsat';

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
}

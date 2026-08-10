/** Where a transmitter row's data came from — independent editability per row. */
export type SatelliteTransmitterSource = 'manual' | 'satnogs';

/**
 * One onboard transmitter/transponder/beacon for a spacecraft. A `Satellite` may have zero
 * (no known frequency data), one, or several — most FM-repeater sats have exactly one; linear
 * transponder birds and multi-mode platforms (e.g. ISS) commonly have 2+.
 *
 * Nested under `Satellite.transmitters` — not a top-level library row, so no `PersistableRow`
 * revision/projectId fields; `id` is a plain UUID for React keys and merge identity only.
 */
export interface SatelliteTransmitter {
  id: string;

  /** Display label. Defaults to the SatNOGS `description` on first sync; always user-editable. */
  label: string;

  /** Free text, e.g. 'FM', 'BPSK', 'CW' — from SatNOGS `mode` or manual entry. No taxonomy. */
  mode: string | null;

  /** Hz, same convention as `Channel.rxFrequency`/`txFrequency`. */
  uplinkHz: number | null;
  downlinkHz: number | null;

  /** CTCSS, Hz. SatNOGS carries no tone data — always manual entry regardless of `source`. */
  uplinkToneHz: number | null;
  downlinkToneHz: number | null;

  /** 'manual' rows are never touched by a SatNOGS refresh merge (phase 2). */
  source: SatelliteTransmitterSource;

  /** SatNOGS transmitter UUID — merge key for phase 2. Always null when `source === 'manual'`. */
  satnogsUuid: string | null;
  /** Last known values from SatNOGS, refreshed on each merge (phase 2). Null for manual rows. */
  satnogsAlive: boolean | null;
  satnogsStatus: string | null;
  /** ISO 8601 — last time this row's SatNOGS-sourced fields were refreshed. */
  satnogsSyncedAt: string | null;

  /**
   * User dismissed this row from the editor UI (phase 3). A SatNOGS re-sync still refreshes a
   * dismissed row's data fields but does not un-dismiss it — this is how "delete" works for a
   * `source: 'satnogs'` row without the merge silently resurrecting it on the next refresh.
   * Always `false` for manual rows (manual delete is a real array removal, not a dismiss flag).
   */
  dismissed: boolean;
}

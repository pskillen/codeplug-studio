import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';

export const FREQUENCY_FIELD_ERROR = 'Enter a positive frequency in MHz.';
export const TONE_FIELD_ERROR = 'Enter a positive tone in Hz.';

/**
 * Non-blocking inline validation: only surfaces once the operator has typed something that
 * fails to parse (covers both non-numeric entry and the out-of-range rejection in units.ts).
 */
export function fieldError(
  rawValue: string,
  parsed: number | null,
  message: string,
): string | undefined {
  return rawValue.trim() !== '' && parsed === null ? message : undefined;
}

/**
 * Rows the operator sees in the editor list — dismissed `source: 'satnogs'` rows stay in the
 * underlying `satellite.transmitters` array (so a later SatNOGS merge can keep refreshing their
 * data without resurrecting them, see `mergeSatnogsTransmittersIntoSatellite`) but are hidden
 * from the editable list.
 */
export function visibleTransmitters(transmitters: SatelliteTransmitter[]): SatelliteTransmitter[] {
  return transmitters.filter((t) => !t.dismissed);
}

/** Absolute local timestamp for a `satnogsSyncedAt` value, or a placeholder when never synced. */
export function formatSatnogsSyncedAt(iso: string | null): string {
  if (!iso) return 'not yet synced';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'not yet synced';
  return at.toLocaleString();
}

/** Small badge/caption text for a transmitter row's source. */
export function transmitterSourceLabel(transmitter: SatelliteTransmitter): string {
  if (transmitter.source === 'manual') return 'Manual';
  return `SatNOGS · synced ${formatSatnogsSyncedAt(transmitter.satnogsSyncedAt)}`;
}

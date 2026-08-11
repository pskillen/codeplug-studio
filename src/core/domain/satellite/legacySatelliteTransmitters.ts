import { newId } from '@core/models/ids.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';

/**
 * Prior to schema v26, `Satellite` carried bare `uplinkHz`/`downlinkHz`/`uplinkToneHz`/
 * `downlinkToneHz` scalars instead of a `transmitters` array. Shared by both migration entry
 * points that still need to read pre-v26 satellite data: the native-yaml import parser
 * (`validate.ts`) and the IndexedDB row reader (`satelliteRow.ts`) — a satellite saved to a
 * browser's local project before this schema bump never passes through file import/export, so
 * the persistence layer needs the same synthesis independently of the file-format boundary.
 */
export const SATELLITE_TRANSMITTERS_MIN_SCHEMA = 26;

export interface LegacySatelliteFrequencyFields {
  uplinkHz: number | null;
  downlinkHz: number | null;
  uplinkToneHz: number | null;
  downlinkToneHz: number | null;
}

/**
 * Synthesize a single manual transmitter from legacy scalar frequency fields (or an empty
 * array when all four were unset), matching the semantics documented in
 * `tmp/features/satellite-followups/spacecraft-multi-transciever/README.md#migration`.
 */
export function synthesizeLegacySatelliteTransmitters(
  fields: LegacySatelliteFrequencyFields,
): SatelliteTransmitter[] {
  const { uplinkHz, downlinkHz, uplinkToneHz, downlinkToneHz } = fields;

  if (
    uplinkHz === null &&
    downlinkHz === null &&
    uplinkToneHz === null &&
    downlinkToneHz === null
  ) {
    return [];
  }

  return [
    {
      id: newId(),
      label: 'Transmitter',
      mode: null,
      uplinkHz,
      downlinkHz,
      uplinkToneHz,
      downlinkToneHz,
      source: 'manual',
      satnogsUuid: null,
      satnogsAlive: null,
      satnogsStatus: null,
      satnogsSyncedAt: null,
      dismissed: false,
    },
  ];
}

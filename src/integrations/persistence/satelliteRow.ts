import { synthesizeLegacySatelliteTransmitters } from '@core/domain/satellite/legacySatelliteTransmitters.ts';
import type { Satellite } from '@core/models/satellite.ts';

/**
 * Shape of a satellite row saved before schema v26 (see
 * `@core/domain/satellite/legacySatelliteTransmitters.ts`): bare uplink/downlink/tone scalars
 * instead of a `transmitters` array. IndexedDB never re-parses rows through the native-yaml
 * import/export migration on load, so a project saved locally before this schema bump still has
 * this legacy shape sitting in the browser's object store.
 */
type LegacySatelliteRow = Omit<Satellite, 'transmitters'> & {
  transmitters?: Satellite['transmitters'];
  uplinkHz?: number | null;
  downlinkHz?: number | null;
  uplinkToneHz?: number | null;
  downlinkToneHz?: number | null;
};

/** Normalise legacy or partial satellite rows read from storage. */
export function readSatelliteRow(row: LegacySatelliteRow): Satellite {
  if (Array.isArray(row.transmitters)) {
    return row as Satellite;
  }

  const { uplinkHz, downlinkHz, uplinkToneHz, downlinkToneHz, ...rest } = row;
  return {
    ...rest,
    transmitters: synthesizeLegacySatelliteTransmitters({
      uplinkHz: uplinkHz ?? null,
      downlinkHz: downlinkHz ?? null,
      uplinkToneHz: uplinkToneHz ?? null,
      downlinkToneHz: downlinkToneHz ?? null,
    }),
  };
}

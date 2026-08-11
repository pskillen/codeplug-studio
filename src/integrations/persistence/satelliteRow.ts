import { synthesizeLegacySatelliteTransmitters } from '@core/domain/satellite/legacySatelliteTransmitters.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';

/**
 * Shape of a satellite row saved before schema v26 (see
 * `@core/domain/satellite/legacySatelliteTransmitters.ts`): bare uplink/downlink/tone scalars
 * instead of a `transmitters` array. IndexedDB never re-parses rows through the native-yaml
 * import/export migration on load, so a project saved locally before this schema bump still has
 * this legacy shape sitting in the browser's object store.
 *
 * `transmitters` entries are typed as `Partial<SatelliteTransmitter>` rather than the full type
 * because a row already in a user's IndexedDB from before `includeInWrite` existed has real
 * `transmitters` entries that lack that field entirely — see `readSatelliteRow` below.
 */
type LegacySatelliteRow = Omit<Satellite, 'transmitters'> & {
  transmitters?: Partial<SatelliteTransmitter>[];
  uplinkHz?: number | null;
  downlinkHz?: number | null;
  uplinkToneHz?: number | null;
  downlinkToneHz?: number | null;
};

/** Normalise legacy or partial satellite rows read from storage. */
export function readSatelliteRow(row: LegacySatelliteRow): Satellite {
  if (Array.isArray(row.transmitters)) {
    return {
      ...row,
      transmitters: row.transmitters.map((t) => ({
        ...t,
        includeInWrite: t.includeInWrite ?? true,
      })),
    } as Satellite;
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

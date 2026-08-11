import { newId } from '@core/models/ids.ts';
import { isoNow } from '@core/models/revision.ts';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitterInfo } from '@core/models/satelliteEnrichment.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';

export interface MergeSatnogsTransmittersResult {
  satellite: Satellite;
  added: number;
  updated: number;
  unchanged: number;
}

/**
 * Merge freshly-fetched SatNOGS transmitter data directly into `satellite.transmitters`,
 * matched by SatNOGS UUID (`satnogsUuid`) — the persisted replacement for the removed
 * session-cache merge that previously lived in `mergeSatelliteEnrichment.ts`. Semantics:
 *  - A fetched transmitter matching an existing `source: 'satnogs'` row (by `satnogsUuid`)
 *    updates that row's `mode`/`uplinkHz`/`downlinkHz`/`satnogsAlive`/`satnogsStatus`/
 *    `satnogsSyncedAt` in place. It never overwrites `label` (frozen after first sync — see
 *    below) or the tone fields (SatNOGS carries no tone data, always manual). A `dismissed`
 *    row's data still updates but `dismissed` itself is untouched — re-syncing does not
 *    resurrect a row the operator hid.
 *  - A fetched transmitter with no matching existing row is appended as a new
 *    `source: 'satnogs'` row, with `label` seeded from the SatNOGS `description` (only at
 *    creation time — never touched again by later merges, so a user rename sticks).
 *  - Rows with `source: 'manual'` are never read or written by this function.
 *  - SatNOGS-sourced rows absent from this fetch are kept as-is (no pruning — same precedent
 *    as the session-cache merge this replaces).
 */
export function mergeSatnogsTransmittersIntoSatellite(
  satellite: Satellite,
  fetched: SatelliteTransmitterInfo[],
  fetchedAt: string = isoNow(),
): MergeSatnogsTransmittersResult {
  const byUuid = new Map<string, SatelliteTransmitter>(
    satellite.transmitters
      .filter(
        (t): t is SatelliteTransmitter & { satnogsUuid: string } =>
          t.source === 'satnogs' && t.satnogsUuid !== null,
      )
      .map((t) => [t.satnogsUuid, t]),
  );

  let added = 0;
  let updated = 0;
  let unchanged = 0;
  const seenUuids = new Set<string>();

  const mergedSatnogsRows: SatelliteTransmitter[] = fetched.map((info) => {
    seenUuids.add(info.uuid);
    const existing = byUuid.get(info.uuid);
    if (!existing) {
      added += 1;
      return {
        id: newId(),
        label: info.description || 'SatNOGS transmitter',
        mode: info.mode,
        uplinkHz: info.uplinkHz,
        downlinkHz: info.downlinkHz,
        uplinkToneHz: null,
        downlinkToneHz: null,
        source: 'satnogs',
        satnogsUuid: info.uuid,
        satnogsAlive: info.alive,
        satnogsStatus: info.status,
        satnogsSyncedAt: fetchedAt,
        dismissed: false,
        includeInWrite: true,
      };
    }
    const changed =
      existing.mode !== info.mode ||
      existing.uplinkHz !== info.uplinkHz ||
      existing.downlinkHz !== info.downlinkHz ||
      existing.satnogsAlive !== info.alive ||
      existing.satnogsStatus !== info.status;
    if (changed) updated += 1;
    else unchanged += 1;
    return {
      ...existing,
      mode: info.mode,
      uplinkHz: info.uplinkHz,
      downlinkHz: info.downlinkHz,
      satnogsAlive: info.alive,
      satnogsStatus: info.status,
      satnogsSyncedAt: changed ? fetchedAt : existing.satnogsSyncedAt,
    };
  });

  // SatNOGS-sourced rows not present in this fetch are kept as-is (no pruning — same
  // precedent as the session-cache merge this replaces).
  const staleSatnogsRows = satellite.transmitters.filter(
    (t) => t.source === 'satnogs' && t.satnogsUuid !== null && !seenUuids.has(t.satnogsUuid),
  );
  const manualRows = satellite.transmitters.filter((t) => t.source === 'manual');

  return {
    satellite: {
      ...satellite,
      transmitters: [...manualRows, ...mergedSatnogsRows, ...staleSatnogsRows],
    },
    added,
    updated,
    unchanged,
  };
}

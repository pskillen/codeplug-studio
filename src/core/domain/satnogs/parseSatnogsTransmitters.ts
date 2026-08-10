import type { SatelliteTransmitterInfo } from '@core/models/satelliteEnrichment.ts';
import type { SatnogsTransmitterRaw } from './satnogsTypes.ts';

/**
 * Decoded SatNOGS transmitter set for one satellite prior to enrichment merge (no `source`/
 * `fetchedAt` — assigned by the integrations-layer merge step), mirroring how `ParsedTleEntry`
 * omits `id`/`enabled`/`source` for the same reason.
 */
export interface ParsedSatnogsEnrichmentEntry {
  noradId: number;
  transmitters: SatelliteTransmitterInfo[];
}

/** Map one raw SatNOGS transmitter record onto the vendor-neutral `SatelliteTransmitterInfo` shape. */
export function mapSatnogsTransmitter(raw: SatnogsTransmitterRaw): SatelliteTransmitterInfo {
  return {
    uuid: raw.uuid,
    description: raw.description ?? '',
    mode: raw.mode ?? null,
    downlinkHz: raw.downlink_low ?? null,
    uplinkHz: raw.uplink_low ?? null,
    alive: raw.alive === true,
    status: raw.status ?? null,
  };
}

/**
 * Group raw SatNOGS transmitter records by NORAD id — a single fetch (or a batch across
 * several satellites) can return transmitters for more than one satellite.
 */
export function groupSatnogsTransmittersByNoradId(
  raw: SatnogsTransmitterRaw[],
): ParsedSatnogsEnrichmentEntry[] {
  const byNorad = new Map<number, SatelliteTransmitterInfo[]>();
  for (const record of raw) {
    const list = byNorad.get(record.norad_cat_id) ?? [];
    list.push(mapSatnogsTransmitter(record));
    byNorad.set(record.norad_cat_id, list);
  }
  return Array.from(byNorad.entries()).map(([noradId, transmitters]) => ({
    noradId,
    transmitters,
  }));
}

import type { ParsedSatnogsEnrichmentEntry } from '@core/domain/satnogs/parseSatnogsTransmitters.ts';
import { isoNow } from '@core/models/revision.ts';
import type {
  SatelliteEnrichment,
  SatelliteTransmitterInfo,
} from '@core/models/satelliteEnrichment.ts';

export interface MergeSatelliteEnrichmentResult {
  rows: SatelliteEnrichment[];
  added: number;
  updated: number;
  unchanged: number;
}

function transmitterKey(transmitter: SatelliteTransmitterInfo): string {
  return [
    transmitter.uuid,
    transmitter.description,
    transmitter.mode ?? '',
    transmitter.downlinkHz ?? '',
    transmitter.uplinkHz ?? '',
    transmitter.alive,
    transmitter.status ?? '',
  ].join('|');
}

function transmittersEqual(a: SatelliteTransmitterInfo[], b: SatelliteTransmitterInfo[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].map(transmitterKey).sort();
  const sortedB = [...b].map(transmitterKey).sort();
  return sortedA.every((key, index) => key === sortedB[index]);
}

/**
 * Merge freshly fetched SatNOGS transmitter data into the session-scoped enrichment set,
 * keyed by NORAD catalog id — the same merge key as `mergeSatelliteSet`, but a distinct
 * payload shape (transmitters, not TLE lines) and distinct "did this change" comparison, so
 * this is a sibling function rather than an overload of `mergeSatelliteSet` itself.
 *
 * Unlike `mergeSatelliteSet`, this set is session-scoped (not persisted as part of the
 * `Satellite`/native-yaml shape) — see `SatelliteEnrichmentSource` for the modelling
 * rationale. Entries absent from a fresh fetch are kept, not deleted, matching
 * `mergeSatelliteSet`'s "no upstream directive to prune" precedent.
 */
export function mergeSatelliteEnrichmentSet(
  existing: SatelliteEnrichment[],
  incoming: ParsedSatnogsEnrichmentEntry[],
): MergeSatelliteEnrichmentResult {
  const remainingByNorad = new Map(existing.map((row) => [row.noradId, row]));
  const rows: SatelliteEnrichment[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const entry of incoming) {
    const match = remainingByNorad.get(entry.noradId);
    if (!match) {
      rows.push({
        noradId: entry.noradId,
        source: 'satnogs',
        transmitters: entry.transmitters,
        fetchedAt: isoNow(),
      });
      added += 1;
      continue;
    }

    remainingByNorad.delete(entry.noradId);
    const changed = !transmittersEqual(match.transmitters, entry.transmitters);
    rows.push({
      noradId: entry.noradId,
      source: 'satnogs',
      transmitters: entry.transmitters,
      fetchedAt: changed ? isoNow() : match.fetchedAt,
    });
    if (changed) {
      updated += 1;
    } else {
      unchanged += 1;
    }
  }

  for (const kept of remainingByNorad.values()) {
    rows.push(kept);
  }

  return { rows, added, updated, unchanged };
}

import type { ParsedTleEntry } from '@core/domain/tle/tleTypes.ts';
import { newId } from '@core/models/ids.ts';
import { initialRevision, isoNow } from '@core/models/revision.ts';
import type { Satellite, SatelliteSource } from '@core/models/satellite.ts';

export interface MergeSatelliteSetResult {
  rows: Satellite[];
  added: number;
  updated: number;
  unchanged: number;
}

/**
 * Merge a freshly fetched TLE set into the curated per-project satellite
 * library, keyed by NORAD catalog id. Existing `id`/`enabled`/`revision` are
 * preserved on a match; satellites absent from the fresh fetch are kept, not
 * deleted — there is no upstream directive to prune a curated list.
 */
export function mergeSatelliteSet(
  existing: Satellite[],
  incoming: ParsedTleEntry[],
  source: SatelliteSource,
  projectId: string,
): MergeSatelliteSetResult {
  const remainingByNorad = new Map(existing.map((row) => [row.noradId, row]));
  const rows: Satellite[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;

  for (const entry of incoming) {
    const match = remainingByNorad.get(entry.noradId);
    if (!match) {
      rows.push({
        ...entry,
        id: newId(),
        projectId,
        revision: initialRevision(),
        updatedAt: isoNow(),
        enabled: true,
        source,
      });
      added += 1;
      continue;
    }

    remainingByNorad.delete(entry.noradId);
    const changed = match.tleLine1 !== entry.tleLine1 || match.tleLine2 !== entry.tleLine2;
    rows.push({
      ...entry,
      id: match.id,
      projectId: match.projectId,
      revision: match.revision,
      updatedAt: match.updatedAt,
      enabled: match.enabled,
      source,
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

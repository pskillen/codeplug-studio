/**
 * Per-zone scan sets for builds with the zone scan set trait (`BuildCapabilityTrait.ZoneScanSet`):
 * which members of each exported zone the radio scans while that zone is selected ("Scan in this
 * zone"). Resolved once here so every radio writer receives the same, finished sets.
 *
 * The per-channel scan flag ("Scan in All channels", `Channel.scanInclusion`) plays no part.
 */

import type { AssembledBuild, LibrarySlice } from '@core/services/assemble.ts';
import type { ZoneBehaviourContext } from '@core/import-export/zoneBehaviourDefaults/index.ts';
import { layoutEntry, scanMemberIds } from '@core/import-export/zoneDerivedScanLists/members.ts';

export interface ZoneScanSet {
  /** Library zone id of the exported zone. */
  zoneId: string;
  /** The zone's wire name as assembled (before any radio's text folding). */
  wireName: string;
  /**
   * Exported members of the zone that are in its scan set, in the zone's export member order.
   * Always a subset of the assembled zone's `memberChannelIds`.
   */
  scanChannelIds: string[];
}

/**
 * One scan set per assembled zone, in assembled zone order. A member is in the set when the zone
 * member cascade (library zone default, member override, build default, this build's per-zone
 * choice) resolves to include. Members outside the build are never in a set.
 */
export function resolveZoneScanSets(
  assembled: Pick<AssembledBuild, 'zones' | 'zoneGrouping'>,
  library: Pick<LibrarySlice, 'zones'>,
  context?: ZoneBehaviourContext,
): ZoneScanSet[] {
  const zoneById = new Map(library.zones.map((zone) => [zone.id, zone]));
  return assembled.zones.map((zone) => {
    const libraryZone = zoneById.get(zone.zoneId);
    if (!libraryZone) {
      return { zoneId: zone.zoneId, wireName: zone.wireName, scanChannelIds: [] };
    }
    const inSet = new Set(
      scanMemberIds(libraryZone, library.zones, {
        context,
        layoutEntry: layoutEntry(assembled.zoneGrouping, zone.zoneId),
      }),
    );
    return {
      zoneId: zone.zoneId,
      wireName: zone.wireName,
      scanChannelIds: zone.memberChannelIds.filter((id) => inSet.has(id)),
    };
  });
}

/**
 * A scan set as radio channel numbers: the zone's own channel numbers (as the radio will write
 * them) that belong to a channel in the set. Keeps the zone's number order.
 */
export function zoneScanSetChannelNumbers(
  scanChannelIds: readonly string[],
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>,
  zoneChannelNumbers: readonly number[],
): number[] {
  const wanted = new Set<number>();
  for (const id of scanChannelIds) {
    for (const n of numbersBySourceChannelId.get(id) ?? []) wanted.add(n);
  }
  return zoneChannelNumbers.filter((n) => wanted.has(n));
}

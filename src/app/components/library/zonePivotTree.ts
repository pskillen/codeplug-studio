import type { Zone } from '@core/models/library.ts';
import { normalizeZoneMemberEntry } from '@core/domain/zoneMembers.ts';
import { sortByName } from '../../lib/channels.ts';

export interface ZonePivotTreeRow {
  zone: Zone;
  depth: number;
}

/** Zones sorted by nesting depth then name — child zones indented in the pivot panel. */
export function buildZonePivotTreeRows(zones: Zone[]): ZonePivotTreeRow[] {
  const parents = new Map<string, string[]>();
  for (const zone of zones) {
    for (const raw of zone.members) {
      const member = normalizeZoneMemberEntry(raw);
      if (member.kind === 'zone') {
        parents.set(member.zoneId, [...(parents.get(member.zoneId) ?? []), zone.id]);
      }
    }
  }

  const depths = new Map<string, number>();

  function depthFor(zoneId: string, visiting: Set<string>): number {
    const cached = depths.get(zoneId);
    if (cached != null) return cached;
    if (visiting.has(zoneId)) return 0;
    visiting.add(zoneId);
    const parentIds = parents.get(zoneId) ?? [];
    const depth =
      parentIds.length === 0 ? 0 : 1 + Math.max(...parentIds.map((id) => depthFor(id, visiting)));
    depths.set(zoneId, depth);
    return depth;
  }

  for (const zone of zones) {
    depthFor(zone.id, new Set());
  }

  return sortByName(zones).map((zone) => ({
    zone,
    depth: depths.get(zone.id) ?? 0,
  }));
}

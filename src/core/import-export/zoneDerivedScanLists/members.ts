import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { memberIncludedInScanList, normalizeZoneMemberEntry } from '@core/domain/zoneMembers.ts';

export function scanMasterEnabled(options?: CpsExportOptions): boolean {
  return options?.exportZoneDerivedScanLists !== false;
}

export function layoutEntry(
  layout: ZoneGroupingLayout | undefined,
  zoneId: string,
): ZoneGroupingZoneEntry | undefined {
  return layout?.zones.find((zone) => zone.id === zoneId);
}

function walkZoneChannelIds(
  zone: Zone,
  zonesById: Map<string, Zone>,
  includeOnlyScanListMembers: boolean,
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  function walk(current: Zone): void {
    for (const raw of current.members) {
      const member = normalizeZoneMemberEntry(raw);
      if (member.kind === 'channel') {
        if (includeOnlyScanListMembers && !memberIncludedInScanList(member)) continue;
        if (seen.has(member.channelId)) continue;
        seen.add(member.channelId);
        result.push(member.channelId);
        continue;
      }
      const child = zonesById.get(member.zoneId);
      if (child) walk(child);
    }
  }

  walk(zone);
  return result;
}

/** Channel ids eligible for a zone-derived scan list (honours `includeInScanList`). */
export function scanMemberIds(zone: Zone, zones: Zone[]): string[] {
  const zonesById = new Map(zones.map((row) => [row.id, row]));
  return walkZoneChannelIds(zone, zonesById, true);
}

/** All channel ids under a zone for scan UI totals (ignores `includeInScanList`). */
export function allZoneScanMemberChannelIds(zone: Zone, zones: Zone[]): string[] {
  const zonesById = new Map(zones.map((row) => [row.id, row]));
  return walkZoneChannelIds(zone, zonesById, false);
}

export function zoneScanMemberCounts(
  zone: Zone,
  zones: Zone[],
): { included: number; total: number } {
  const total = allZoneScanMemberChannelIds(zone, zones).length;
  const included = scanMemberIds(zone, zones).length;
  return { included, total };
}

import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { flattenZoneMembership } from '@core/domain/zoneHierarchy.ts';
import { memberIncludedInScanList } from '@core/domain/zoneMembers.ts';

export function scanMasterEnabled(options?: CpsExportOptions): boolean {
  return options?.exportZoneDerivedScanLists !== false;
}

export function layoutEntry(
  layout: ZoneGroupingLayout | undefined,
  zoneId: string,
): ZoneGroupingZoneEntry | undefined {
  return layout?.zones.find((zone) => zone.id === zoneId);
}

/** Channel ids eligible for a zone-derived scan list (honours `includeInScanList`). */
export function scanMemberIds(zone: Zone, zones: Zone[]): string[] {
  return flattenZoneMembership(zone, zones, {
    includeChannel: (member) => memberIncludedInScanList(member),
  }).channelIds;
}

/** All channel ids under a zone for scan UI totals (ignores `includeInScanList`). */
export function allZoneScanMemberChannelIds(zone: Zone, zones: Zone[]): string[] {
  return flattenZoneMembership(zone, zones).channelIds;
}

export interface ZoneScanMemberRef {
  channelId: string;
  ownerZoneId: string;
  includeInScanList: boolean;
}

/** Recursive channel members for scan UI toggles (includes nested zones). */
export function collectZoneScanMemberRefs(zone: Zone, zones: Zone[]): ZoneScanMemberRef[] {
  const result: ZoneScanMemberRef[] = [];
  flattenZoneMembership(zone, zones, {
    onChannel: (channelId, ownerZoneId, member) => {
      result.push({
        channelId,
        ownerZoneId,
        includeInScanList: memberIncludedInScanList(member),
      });
    },
  });
  return result;
}

export function zoneScanMemberCounts(
  zone: Zone,
  zones: Zone[],
): { included: number; total: number } {
  const total = allZoneScanMemberChannelIds(zone, zones).length;
  const included = scanMemberIds(zone, zones).length;
  return { included, total };
}

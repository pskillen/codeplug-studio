import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  effectiveIncludeInZoneDerivedScanList,
  type ZoneBehaviourContext,
} from '@core/import-export/zoneBehaviourDefaults/index.ts';
import { flattenZoneMembership } from '@core/domain/zoneHierarchy.ts';
import { normalizeZoneMemberEntry } from '@core/domain/zoneMembers.ts';

export function scanMasterEnabled(options?: CpsExportOptions): boolean {
  return options?.exportZoneDerivedScanLists !== false;
}

export function layoutEntry(
  layout: ZoneGroupingLayout | undefined,
  zoneId: string,
): ZoneGroupingZoneEntry | undefined {
  return layout?.zones.find((zone) => zone.id === zoneId);
}

export interface ScanMemberResolveOptions {
  context?: ZoneBehaviourContext;
  /** Layout entry for the **exported** zone (projection skips apply here only). */
  layoutEntry?: ZoneGroupingZoneEntry;
}

/** Channel ids eligible for a zone-derived scan list (honours zone behavioural cascade). */
export function scanMemberIds(
  zone: Zone,
  zones: Zone[],
  resolveOptions?: ScanMemberResolveOptions,
): string[] {
  const context = resolveOptions?.context;
  const projection = resolveOptions?.layoutEntry?.scanMemberInclusion;
  return flattenZoneMembership(zone, zones, {
    includeChannel: (member) => {
      if (member.kind !== 'channel') return true;
      return effectiveIncludeInZoneDerivedScanList({
        memberOverride: member.includeInScanList ?? 'default',
        channelId: member.channelId,
        context,
        projection,
      });
    },
  }).channelIds;
}

/** All channel ids under a zone for scan UI totals (ignores scan membership filters). */
export function allZoneScanMemberChannelIds(zone: Zone, zones: Zone[]): string[] {
  return flattenZoneMembership(zone, zones).channelIds;
}

export interface ZoneScanMemberRef {
  channelId: string;
  ownerZoneId: string;
  /** Raw member override (before cascade). */
  memberOverride: 'default' | 'include' | 'skip';
  /** Effective include after cascade for the given exported-zone options. */
  includeInScanList: boolean;
}

/** Recursive channel members for scan UI toggles (includes nested zones). */
export function collectZoneScanMemberRefs(
  zone: Zone,
  zones: Zone[],
  resolveOptions?: ScanMemberResolveOptions,
): ZoneScanMemberRef[] {
  const result: ZoneScanMemberRef[] = [];
  const context = resolveOptions?.context;
  const projection = resolveOptions?.layoutEntry?.scanMemberInclusion;
  flattenZoneMembership(zone, zones, {
    onChannel: (channelId, ownerZoneId, member) => {
      const normalized = normalizeZoneMemberEntry(member);
      const memberOverride =
        normalized.kind === 'channel' ? (normalized.includeInScanList ?? 'default') : 'default';
      result.push({
        channelId,
        ownerZoneId,
        memberOverride,
        includeInScanList: effectiveIncludeInZoneDerivedScanList({
          memberOverride,
          channelId,
          context,
          projection,
        }),
      });
    },
  });
  return result;
}

export function zoneScanMemberCounts(
  zone: Zone,
  zones: Zone[],
  resolveOptions?: ScanMemberResolveOptions,
): { included: number; total: number } {
  const total = allZoneScanMemberChannelIds(zone, zones).length;
  const included = scanMemberIds(zone, zones, resolveOptions).length;
  return { included, total };
}

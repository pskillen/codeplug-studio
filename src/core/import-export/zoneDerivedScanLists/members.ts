import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  effectiveIncludeInZoneDerivedScanList,
  type ZoneBehaviourContext,
} from '@core/import-export/zoneBehaviourDefaults/index.ts';
import { flattenZoneMembership } from '@core/domain/zoneHierarchy.ts';
import { normalizeZoneMemberEntry } from '@core/domain/zoneMembers.ts';
import type { ExpandedMxNChannelRow } from '../channelExpansion/mxnExpandAll.ts';

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

/**
 * Whether a scan membership key (parent channel id or projection key) is included.
 * Parent-id skip/include in `scanMemberInclusion` still gates the whole channel;
 * projection-key `skip` omits one expanded wire only (#570).
 */
export function effectiveIncludeInZoneDerivedScanListForKey(args: {
  memberOverride?: 'default' | 'include' | 'skip' | null;
  channelId: string;
  /** Parent id or expansion projection key (same string space as channelOverrides). */
  memberKey: string;
  context?: ZoneBehaviourContext;
  projection?: Record<string, 'include' | 'skip'> | null;
}): boolean {
  const parentIncluded = effectiveIncludeInZoneDerivedScanList({
    memberOverride: args.memberOverride,
    channelId: args.channelId,
    context: args.context,
    projection: args.projection,
  });
  if (!parentIncluded) return false;
  if (args.memberKey === args.channelId) return true;
  if (args.projection?.[args.memberKey] === 'skip') return false;
  return true;
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

/**
 * Projection-aware scan member for Scan-tab UI (#570).
 * `memberKey` is the `scanMemberInclusion` key (parent id or expansion key).
 */
export interface ZoneScanProjectionMemberRef extends ZoneScanMemberRef {
  memberKey: string;
  wireName?: string;
  nestRole?: 'parent' | 'child';
  nestChildCount?: number;
  displayLabel: string;
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

/**
 * Scan-tab rows: nest expanded projections under parent when `expansionByChannelId`
 * has more than one row for a channel; otherwise one flat row per channel.
 */
export function collectZoneScanProjectionMemberRefs(
  zone: Zone,
  zones: Zone[],
  resolveOptions: ScanMemberResolveOptions | undefined,
  expansionByChannelId:
    | Map<string, ReadonlyArray<Pick<ExpandedMxNChannelRow, 'key' | 'wireName'>>>
    | undefined,
  channelLabel: (channelId: string) => string,
): ZoneScanProjectionMemberRef[] {
  const base = collectZoneScanMemberRefs(zone, zones, resolveOptions);
  const projection = resolveOptions?.layoutEntry?.scanMemberInclusion;
  const context = resolveOptions?.context;
  const result: ZoneScanProjectionMemberRef[] = [];

  for (const member of base) {
    const expanded = expansionByChannelId?.get(member.channelId);
    if (!expanded || expanded.length <= 1) {
      const only = expanded?.[0];
      result.push({
        ...member,
        memberKey: member.channelId,
        wireName: only?.wireName,
        displayLabel: channelLabel(member.channelId),
        includeInScanList: effectiveIncludeInZoneDerivedScanListForKey({
          memberOverride: member.memberOverride,
          channelId: member.channelId,
          memberKey: member.channelId,
          context,
          projection,
        }),
      });
      continue;
    }

    result.push({
      ...member,
      memberKey: member.channelId,
      nestRole: 'parent',
      nestChildCount: expanded.length,
      displayLabel: channelLabel(member.channelId),
      includeInScanList: effectiveIncludeInZoneDerivedScanList({
        memberOverride: member.memberOverride,
        channelId: member.channelId,
        context,
        projection,
      }),
    });

    for (const row of expanded) {
      result.push({
        ...member,
        memberKey: row.key,
        nestRole: 'child',
        wireName: row.wireName,
        displayLabel: row.wireName,
        includeInScanList: effectiveIncludeInZoneDerivedScanListForKey({
          memberOverride: member.memberOverride,
          channelId: member.channelId,
          memberKey: row.key,
          context,
          projection,
        }),
      });
    }
  }

  return result;
}

export function zoneScanMemberCounts(
  zone: Zone,
  zones: Zone[],
  resolveOptions?: ScanMemberResolveOptions,
  expansionByChannelId?: Map<string, ReadonlyArray<{ key: string; sourceChannelId: string }>>,
): { included: number; total: number } {
  if (!expansionByChannelId) {
    const total = allZoneScanMemberChannelIds(zone, zones).length;
    const included = scanMemberIds(zone, zones, resolveOptions).length;
    return { included, total };
  }

  const allChannelIds = allZoneScanMemberChannelIds(zone, zones);
  const memberOverrideByChannelId = new Map<string, 'default' | 'include' | 'skip'>();
  flattenZoneMembership(zone, zones, {
    onChannel: (channelId, _owner, member) => {
      const normalized = normalizeZoneMemberEntry(member);
      if (normalized.kind === 'channel') {
        memberOverrideByChannelId.set(channelId, normalized.includeInScanList ?? 'default');
      }
    },
  });

  let total = 0;
  let included = 0;
  const projection = resolveOptions?.layoutEntry?.scanMemberInclusion;
  const context = resolveOptions?.context;

  for (const channelId of allChannelIds) {
    const rows = expansionByChannelId.get(channelId) ?? [
      { key: channelId, sourceChannelId: channelId },
    ];
    total += rows.length;
    for (const row of rows) {
      if (
        effectiveIncludeInZoneDerivedScanListForKey({
          memberOverride: memberOverrideByChannelId.get(channelId) ?? 'default',
          channelId,
          memberKey: row.key,
          context,
          projection,
        })
      ) {
        included += 1;
      }
    }
  }

  return { included, total };
}

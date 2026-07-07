import type { Channel, Zone } from '@core/models/library.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { buildScanContext, effectiveScanSkips } from '@core/import-export/scanInclusion/index.ts';
import type { AssembledBuild, LibrarySlice } from '@core/services/assemble.ts';
import { memberIncludedInScanList, normalizeZoneMemberEntry } from '@core/domain/zoneMembers.ts';
import type { ExpandedDm32ChannelRow } from '../formats/dm32/channelExpansion.ts';
import { newChannel } from '@core/domain/factories.ts';
import { SCAN_COL } from '../formats/dm32/columns.ts';
import { DEFAULT_DM32_PROFILE_ID, getDm32Profile } from '../formats/dm32/profiles.ts';
import { applyWireNameLimits } from '../channelExpansion/exportWireNames.ts';

export const DEFAULT_SCAN_CARRIER_HZ = 145_500_000;

export interface ScanCsvRow {
  values: Record<string, string>;
}

export interface SyntheticScanCarrier {
  zoneId: string;
  zoneName: string;
  wireName: string;
  frequencyHz: number;
  scanListName: string;
}

export interface ZoneDerivedScanExport {
  scanRows: ScanCsvRow[];
  carriers: SyntheticScanCarrier[];
  /** Channel wire name → scan list name for Channels.csv `Scan List` column. */
  scanListByChannelWireName: Map<string, string>;
  /** Zone id → carrier wire name to prepend in Zones.csv member list. */
  carrierPrependByZoneId: Map<string, string>;
}

function scanMasterEnabled(options?: CpsExportOptions): boolean {
  return options?.exportZoneDerivedScanLists !== false;
}

function layoutEntry(
  layout: ZoneGroupingLayout | undefined,
  zoneId: string,
): ZoneGroupingZoneEntry | undefined {
  return layout?.zones.find((zone) => zone.id === zoneId);
}

function scanMemberIds(zone: Zone, zones: Zone[]): string[] {
  const zonesById = new Map(zones.map((row) => [row.id, row]));
  const result: string[] = [];
  const seen = new Set<string>();

  function walk(current: Zone): void {
    for (const raw of current.members) {
      const member = normalizeZoneMemberEntry(raw);
      if (member.kind === 'channel') {
        if (!memberIncludedInScanList(member)) continue;
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

function expandedWireNamesForMembers(
  memberIds: string[],
  channelById: Map<string, Channel>,
  expansionByChannelId: Map<string, ExpandedDm32ChannelRow[]>,
  options?: CpsExportOptions,
): string[] {
  const scanContext = buildScanContext(
    options?.defaultScanInclusion != null
      ? { defaultScanInclusion: options.defaultScanInclusion }
      : undefined,
    { defaultScanInclusion: 'scan' },
  );
  const names: string[] = [];
  for (const channelId of memberIds) {
    const channel = channelById.get(channelId);
    if (!channel || effectiveScanSkips(channel, scanContext)) continue;
    for (const row of expansionByChannelId.get(channelId) ?? []) {
      names.push(row.wireName);
    }
  }
  return names;
}

function shortenCarrierName(
  zoneName: string,
  profileId: string,
  reserved: Set<string>,
  warnings: string[],
): string {
  const base = `${zoneName} Scan`.trim();
  const stub = {
    ...newChannel('', base),
    id: 'carrier',
    projectId: '',
  };
  return applyWireNameLimits(base, stub, reserved, { shortenNames: true }, profileId, warnings);
}

/** Derive zone-based Scan.csv rows and carrier channels for DM32 export. */
export function deriveZoneDerivedScanLists(
  assembled: AssembledBuild,
  library: LibrarySlice,
  expansionByChannelId: Map<string, ExpandedDm32ChannelRow[]>,
  options?: CpsExportOptions,
  warnings: string[] = [],
): ZoneDerivedScanExport {
  const result: ZoneDerivedScanExport = {
    scanRows: [],
    carriers: [],
    scanListByChannelWireName: new Map(),
    carrierPrependByZoneId: new Map(),
  };

  if (!scanMasterEnabled(options)) return result;

  const layout = assembled.zoneGrouping;
  if (!layout) return result;

  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_DM32_PROFILE_ID;
  const profile = getDm32Profile(profileId);
  const channelById = new Map(library.channels.map((channel) => [channel.id, channel]));
  const zoneById = new Map(library.zones.map((zone) => [zone.id, zone]));
  const reservedNames = new Set<string>();
  let rowNumber = 0;

  for (const assembledZone of assembled.zones) {
    const entry = layoutEntry(layout, assembledZone.zoneId);
    if (!entry?.exportScanList) continue;

    const libraryZone = zoneById.get(assembledZone.zoneId);
    if (!libraryZone) continue;

    const memberIds = scanMemberIds(libraryZone, library.zones);
    const memberWireNames = expandedWireNamesForMembers(
      memberIds,
      channelById,
      expansionByChannelId,
      options,
    );

    if (memberWireNames.length === 0) {
      warnings.push(
        `Zone "${assembledZone.wireName}" has no scan-eligible members; scan list skipped`,
      );
      continue;
    }

    const scanListName = assembledZone.wireName;
    const truncated =
      memberWireNames.length > profile.scanListMembers
        ? memberWireNames.slice(0, profile.scanListMembers)
        : memberWireNames;

    if (truncated.length < memberWireNames.length) {
      warnings.push(
        `Zone "${assembledZone.wireName}" scan list truncated from ${memberWireNames.length} to ${profile.scanListMembers} members`,
      );
    }

    const carrierWireName = shortenCarrierName(
      assembledZone.wireName,
      profileId,
      reservedNames,
      warnings,
    );
    reservedNames.add(carrierWireName);

    const carrierHz = entry.scanCarrierFrequencyHz ?? DEFAULT_SCAN_CARRIER_HZ;

    result.carriers.push({
      zoneId: assembledZone.zoneId,
      zoneName: assembledZone.wireName,
      wireName: carrierWireName,
      frequencyHz: carrierHz,
      scanListName,
    });
    result.carrierPrependByZoneId.set(assembledZone.zoneId, carrierWireName);

    for (const wireName of truncated) {
      result.scanListByChannelWireName.set(wireName, scanListName);
    }
    result.scanListByChannelWireName.set(carrierWireName, scanListName);

    rowNumber += 1;
    result.scanRows.push({
      values: {
        [SCAN_COL.number]: String(rowNumber),
        [SCAN_COL.name]: scanListName,
        [SCAN_COL.ctcScanMode]: 'Detection CTC',
        [SCAN_COL.scanTxMode]: 'Last Actived Channel',
        [SCAN_COL.hangTime]: '5.0',
        [SCAN_COL.priorityChannel1]: 'None',
        [SCAN_COL.priorityChannel2]: 'None',
        [SCAN_COL.designedChannel]: carrierWireName,
        [SCAN_COL.prioritySweepTime]: '500',
        [SCAN_COL.talkback]: '0',
        [SCAN_COL.channelMembers]: truncated.join('|'),
      },
    });
  }

  return result;
}

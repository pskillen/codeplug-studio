import type { CpsExportOptions } from '@core/import-export/types.ts';
import { buildScanContext, effectiveScanSkips } from '@core/import-export/scanInclusion/index.ts';
import {
  DEFAULT_SCAN_CARRIER_HZ,
  zoneScanCarrierWireName,
  type SyntheticScanCarrier,
} from '@core/import-export/zoneDerivedScanLists/carrier.ts';
import { classifyAnytoneExportChannelBank } from './receiveOnlyBanks.ts';
import {
  layoutEntry,
  scanMasterEnabled,
  scanMemberIds,
} from '@core/import-export/zoneDerivedScanLists/members.ts';
import type { AssembledBuild, AssembledScanList, LibrarySlice } from '@core/services/assemble.ts';
import { DEFAULT_ANYTONE_PROFILE_ID, getAnytoneProfile } from './profiles.ts';

export const ZONE_DERIVED_SCAN_LIST_ID_PREFIX = 'zone-derived:';

export function zoneDerivedScanListId(zoneId: string): string {
  return `${ZONE_DERIVED_SCAN_LIST_ID_PREFIX}${zoneId}`;
}

export function zoneIdFromDerivedScanListId(scanListId: string): string | undefined {
  if (!scanListId.startsWith(ZONE_DERIVED_SCAN_LIST_ID_PREFIX)) return undefined;
  const zoneId = scanListId.slice(ZONE_DERIVED_SCAN_LIST_ID_PREFIX.length);
  return zoneId.length > 0 ? zoneId : undefined;
}

export interface AnytoneZoneDerivedScanExport {
  scanLists: AssembledScanList[];
  carriers: SyntheticScanCarrier[];
  carrierPrependByZoneId: Map<string, string>;
}

/** Derive zone-based scan lists and carrier channels for Anytone export. */
export function deriveAnytoneZoneDerivedScanLists(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): AnytoneZoneDerivedScanExport {
  const result: AnytoneZoneDerivedScanExport = {
    scanLists: [],
    carriers: [],
    carrierPrependByZoneId: new Map(),
  };

  if (!scanMasterEnabled(options)) return result;

  const layout = assembled.zoneGrouping;
  if (!layout) return result;

  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_ANYTONE_PROFILE_ID;
  const profile = getAnytoneProfile(profileId);
  const channelById = new Map(library.channels.map((channel) => [channel.id, channel]));
  const zoneById = new Map(library.zones.map((zone) => [zone.id, zone]));
  const exportedChannelIds = new Set(assembled.channels.map((row) => row.entity.id));
  const scanContext = buildScanContext(
    options?.defaultScanInclusion != null
      ? { defaultScanInclusion: options.defaultScanInclusion }
      : undefined,
    { defaultScanInclusion: 'scan' },
  );
  const reservedNames = new Set<string>();

  for (const assembledZone of assembled.zones) {
    const entry = layoutEntry(layout, assembledZone.zoneId);
    if (!entry?.exportScanList) continue;

    const libraryZone = zoneById.get(assembledZone.zoneId);
    if (!libraryZone) continue;

    let memberIds = scanMemberIds(libraryZone, library.zones).filter((channelId) => {
      if (!exportedChannelIds.has(channelId)) return false;
      const channel = channelById.get(channelId);
      return (
        channel != null &&
        !effectiveScanSkips(channel, scanContext) &&
        classifyAnytoneExportChannelBank(channel) === 'dmr'
      );
    });

    if (memberIds.length === 0) {
      warnings.push(
        `Zone "${assembledZone.wireName}" has no scan-eligible members; scan list skipped`,
      );
      continue;
    }

    if (memberIds.length > profile.scanListMembers) {
      warnings.push(
        `Zone "${assembledZone.wireName}" scan list truncated from ${memberIds.length} to ${profile.scanListMembers} members`,
      );
      memberIds = memberIds.slice(0, profile.scanListMembers);
    }

    const scanListName = assembledZone.wireName;
    const carrierWireName = zoneScanCarrierWireName(
      assembledZone.wireName,
      profileId,
      reservedNames,
      warnings,
    );
    reservedNames.add(carrierWireName);
    const carrierHz = entry.scanCarrierFrequencyHz ?? DEFAULT_SCAN_CARRIER_HZ;

    result.scanLists.push({
      scanListId: zoneDerivedScanListId(assembledZone.zoneId),
      wireName: scanListName,
      memberChannelIds: memberIds,
    });
    result.carriers.push({
      zoneId: assembledZone.zoneId,
      zoneName: assembledZone.wireName,
      wireName: carrierWireName,
      frequencyHz: carrierHz,
      scanListName,
    });
    result.carrierPrependByZoneId.set(assembledZone.zoneId, carrierWireName);
  }

  return result;
}

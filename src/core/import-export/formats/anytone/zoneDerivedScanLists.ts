import type { CpsExportOptions } from '@core/import-export/types.ts';
import { buildScanContext, effectiveScanSkips } from '@core/import-export/scanInclusion/index.ts';
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

export interface AnytoneZoneDerivedScanExport {
  scanLists: AssembledScanList[];
}

/** Derive zone-based scan lists for Anytone ScanList.CSV (no carrier channel). */
export function deriveAnytoneZoneDerivedScanLists(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): AnytoneZoneDerivedScanExport {
  const result: AnytoneZoneDerivedScanExport = { scanLists: [] };

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

  for (const assembledZone of assembled.zones) {
    const entry = layoutEntry(layout, assembledZone.zoneId);
    if (!entry?.exportScanList) continue;

    const libraryZone = zoneById.get(assembledZone.zoneId);
    if (!libraryZone) continue;

    let memberIds = scanMemberIds(libraryZone, library.zones).filter((channelId) => {
      if (!exportedChannelIds.has(channelId)) return false;
      const channel = channelById.get(channelId);
      return channel != null && !effectiveScanSkips(channel, scanContext);
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

    result.scanLists.push({
      scanListId: zoneDerivedScanListId(assembledZone.zoneId),
      wireName: assembledZone.wireName,
      memberChannelIds: memberIds,
    });
  }

  return result;
}

import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import { buildScanContext, effectiveScanSkips } from '@core/import-export/scanInclusion/index.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  layoutEntry,
  scanMasterEnabled,
  scanMemberIds,
} from '@core/import-export/zoneDerivedScanLists/members.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { channelNumbersForMembers } from './exportContext.ts';
import type { NeonplugDm32uvRadioProfile } from './profiles.ts';
import type { NeonplugScanList } from './wireTypes.ts';

/** Channel `scanListId` is 4 bits (0–15); 0 = none, so at most 15 referenceable lists. */
export const NEONPLUG_MAX_CHANNEL_SCAN_LIST_ID = 15;

export interface NeonplugZoneDerivedScanExport {
  scanLists: NeonplugScanList[];
  /** Channel UUID → 1-based NeonPlug `scanListId`. */
  scanListIdByChannelId: Map<string, number>;
}

/**
 * Zone-derived scan lists for NeonPlug DM32UV — no synthetic carriers.
 * Reuses format-agnostic scan membership helpers; projects channel **numbers**.
 */
export function deriveNeonplugZoneDerivedScanLists(
  assembled: AssembledBuild,
  profile: NeonplugDm32uvRadioProfile,
  channelNumberById: Map<string, number>,
  options?: CpsExportOptions,
  warnings: string[] = [],
): NeonplugZoneDerivedScanExport {
  const result: NeonplugZoneDerivedScanExport = {
    scanLists: [],
    scanListIdByChannelId: new Map(),
  };

  if (!scanMasterEnabled(options)) return result;

  const layout = assembled.zoneGrouping;
  const library = assembled.library;
  if (!layout || !library) return result;

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
  const maxLists = Math.min(profile.maxScanLists, NEONPLUG_MAX_CHANNEL_SCAN_LIST_ID);

  for (const assembledZone of assembled.zones) {
    const entry = layoutEntry(layout, assembledZone.zoneId);
    if (!entry?.exportScanList) continue;

    if (result.scanLists.length >= maxLists) {
      warnings.push(
        `Additional zone-derived scan list(s) skipped; NeonPlug channel scanListId supports at most ${maxLists} lists`,
      );
      break;
    }

    const libraryZone = zoneById.get(assembledZone.zoneId);
    if (!libraryZone) continue;

    let memberIds = scanMemberIds(libraryZone, library.zones, {
      context: options?.zoneBehaviourContext,
      layoutEntry: entry,
    }).filter((channelId) => {
      if (!exportedChannelIds.has(channelId)) return false;
      if (!channelNumberById.has(channelId)) return false;
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

    const name = applyListWireNameLimits(
      assembledZone.wireName,
      reservedNames,
      options,
      profile.id,
      warnings,
      'Scan list',
      profile.scanListNameLimit,
    );

    const channels = channelNumbersForMembers(memberIds, channelNumberById);
    const scanListId = result.scanLists.length + 1;

    result.scanLists.push({
      name,
      channels,
      channelCount: channels.length,
      // Lossy defaults — Studio does not model CTC/TX/hang/priority yet.
      ctcScanMode: 0,
      scanTxMode: 0,
    });

    for (const channelId of memberIds) {
      if (!result.scanListIdByChannelId.has(channelId)) {
        result.scanListIdByChannelId.set(channelId, scanListId);
      }
    }
  }

  return result;
}

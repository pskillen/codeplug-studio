import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import { buildScanContext, effectiveScanSkips } from '@core/import-export/scanInclusion/index.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  DEFAULT_SCAN_CARRIER_HZ,
  zoneScanCarrierWireName,
  type SyntheticScanCarrier,
} from '@core/import-export/zoneDerivedScanLists/carrier.ts';
import {
  layoutEntry,
  scanMasterEnabled,
  scanMemberIds,
} from '@core/import-export/zoneDerivedScanLists/members.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { expandNeonplugZoneMemberNumbers } from './channelExpansion.ts';
import type { NeonplugDm32uvRadioProfile } from './profiles.ts';
import type { NeonplugScanList } from './wireTypes.ts';

/** Channel `scanListId` is 4 bits (0–15); 0 = none, so at most 15 referenceable lists. */
export const NEONPLUG_MAX_CHANNEL_SCAN_LIST_ID = 15;

/**
 * Default name for the DM32UV empty-list floor (#564).
 * Radio field is ≤10 chars; NeonPlug encode truncates — emit the full label in JSON.
 */
export const NEONPLUG_DM32UV_EMPTY_SCAN_LIST_NAME = 'Scan list 1';

export interface NeonplugZoneDerivedScanExport {
  scanLists: NeonplugScanList[];
  /** Channel UUID → 1-based NeonPlug `scanListId` (inherited by all expanded rows). */
  scanListIdByChannelId: Map<string, number>;
  /** Synthetic `{zone} Scan` FM carriers (numbered later in serialise). */
  carriers: SyntheticScanCarrier[];
  /** Zone id → carrier wire name for zone membership prepend. */
  carrierPrependByZoneId: Map<string, string>;
  /** Zone id → 1-based scan list id (for carrier `scanListId` / designated TX). */
  scanListIdByZoneId: Map<string, number>;
}

/**
 * Floor scan list when zone-derived projection is empty (#564).
 * With a member channel number, include it so NeonPlug’s write filter
 * (drops `channels.length === 0`) retains the list. Channels stay unbound
 * (`scanListId` 0) — membership is interop-only.
 */
export function neonplugDm32uvEmptyScanListFloor(memberChannelNumber?: number): NeonplugScanList {
  const hasMember = memberChannelNumber != null && memberChannelNumber > 0;
  return {
    name: NEONPLUG_DM32UV_EMPTY_SCAN_LIST_NAME,
    channels: hasMember ? [memberChannelNumber] : [],
    channelCount: hasMember ? 1 : 0,
    // Lossy defaults — match zone-derived CTC/TX defaults.
    ctcScanMode: 0,
    scanTxMode: 0,
  };
}

/**
 * DM32UV / NeonPlug write path expects ≥1 scan list that survives NeonPlug’s
 * empty-list strip. Floor empty projections; leave non-empty derivation unchanged.
 * Pass first exported channel number when available (zero-channel → memberless).
 */
export function ensureNeonplugDm32uvScanListsFloor(
  scanLists: readonly NeonplugScanList[],
  firstChannelNumber?: number,
): NeonplugScanList[] {
  if (scanLists.length > 0) return [...scanLists];
  return [neonplugDm32uvEmptyScanListFloor(firstChannelNumber)];
}

/**
 * True when zoneGrouping is missing or has no zone entries — assemble already
 * falls back to library zones; scan derivation should too (#562).
 */
export function neonplugZoneGroupingLayoutIsEmpty(layout: AssembledBuild['zoneGrouping']): boolean {
  return layout == null || layout.zones.length === 0;
}

/**
 * Zone-derived scan lists for NeonPlug DM32UV.
 * Reuses format-agnostic scan membership helpers; projects channel **numbers**
 * after m×n expansion, then truncates to `scanListMembers`.
 *
 * When `zoneGrouping` is empty/missing and the scan master is on, each assembled
 * zone is treated as `exportScanList: true` (parity with zone assemble fallback).
 *
 * Also synthesises DM32-parity `{zone} Scan` carrier metadata (numbered in serialise).
 *
 * @param reservedWireNames — existing channel wire names so carrier labels stay unique
 */
export function deriveNeonplugZoneDerivedScanLists(
  assembled: AssembledBuild,
  profile: NeonplugDm32uvRadioProfile,
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>,
  options?: CpsExportOptions,
  warnings: string[] = [],
  reservedWireNames: Iterable<string> = [],
): NeonplugZoneDerivedScanExport {
  const result: NeonplugZoneDerivedScanExport = {
    scanLists: [],
    scanListIdByChannelId: new Map(),
    carriers: [],
    carrierPrependByZoneId: new Map(),
    scanListIdByZoneId: new Map(),
  };

  if (!scanMasterEnabled(options)) return result;

  const library = assembled.library;
  if (!library) return result;

  const layout = assembled.zoneGrouping;
  const emptyLayoutMode = neonplugZoneGroupingLayoutIsEmpty(layout);

  const channelById = new Map(library.channels.map((channel) => [channel.id, channel]));
  const zoneById = new Map(library.zones.map((zone) => [zone.id, zone]));
  const exportedChannelIds = new Set(assembled.channels.map((row) => row.entity.id));
  const scanContext = buildScanContext(
    options?.defaultScanInclusion != null
      ? { defaultScanInclusion: options.defaultScanInclusion }
      : undefined,
    { defaultScanInclusion: 'scan' },
  );
  const reservedScanListNames = new Set<string>();
  const reservedCarrierNames = new Set(reservedWireNames);
  const maxLists = Math.min(profile.maxScanLists, NEONPLUG_MAX_CHANNEL_SCAN_LIST_ID);

  for (const assembledZone of assembled.zones) {
    const entry = emptyLayoutMode ? undefined : layoutEntry(layout, assembledZone.zoneId);
    if (!emptyLayoutMode && !entry?.exportScanList) continue;

    if (result.scanLists.length >= maxLists) {
      warnings.push(
        `Additional zone-derived scan list(s) skipped; NeonPlug channel scanListId supports at most ${maxLists} lists`,
      );
      break;
    }

    const libraryZone = zoneById.get(assembledZone.zoneId);
    if (!libraryZone) continue;

    const memberIds = scanMemberIds(libraryZone, library.zones, {
      context: options?.zoneBehaviourContext,
      layoutEntry: entry,
    }).filter((channelId) => {
      if (!exportedChannelIds.has(channelId)) return false;
      const numbers = numbersBySourceChannelId.get(channelId);
      if (numbers == null || numbers.length === 0) return false;
      const channel = channelById.get(channelId);
      return channel != null && !effectiveScanSkips(channel, scanContext);
    });

    if (memberIds.length === 0) {
      warnings.push(
        `Zone "${assembledZone.wireName}" has no scan-eligible members; scan list skipped`,
      );
      continue;
    }

    let channels = expandNeonplugZoneMemberNumbers(memberIds, numbersBySourceChannelId);
    if (channels.length > profile.scanListMembers) {
      warnings.push(
        `Zone "${assembledZone.wireName}" scan list truncated from ${channels.length} to ${profile.scanListMembers} members`,
      );
      channels = channels.slice(0, profile.scanListMembers);
    }

    if (channels.length === 0) {
      warnings.push(
        `Zone "${assembledZone.wireName}" has no scan-eligible members; scan list skipped`,
      );
      continue;
    }

    const name = applyListWireNameLimits(
      assembledZone.wireName,
      reservedScanListNames,
      options,
      profile.id,
      warnings,
      'Scan list',
      profile.scanListNameLimit,
    );

    const scanListId = result.scanLists.length + 1;
    const carrierWireName = zoneScanCarrierWireName(
      assembledZone.wireName,
      profile.id,
      reservedCarrierNames,
      warnings,
    );
    reservedCarrierNames.add(carrierWireName);
    const carrierHz = entry?.scanCarrierFrequencyHz ?? DEFAULT_SCAN_CARRIER_HZ;

    result.scanLists.push({
      name,
      channels,
      channelCount: channels.length,
      // Lossy defaults — Studio does not model CTC/TX/hang/priority yet.
      ctcScanMode: 0,
      scanTxMode: 0,
    });

    result.carriers.push({
      zoneId: assembledZone.zoneId,
      zoneName: assembledZone.wireName,
      wireName: carrierWireName,
      frequencyHz: carrierHz,
      scanListName: name,
    });
    result.carrierPrependByZoneId.set(assembledZone.zoneId, carrierWireName);
    result.scanListIdByZoneId.set(assembledZone.zoneId, scanListId);
    result.scanListIdByChannelId.set(`scan-carrier:${assembledZone.zoneId}`, scanListId);

    for (const channelId of memberIds) {
      if (!result.scanListIdByChannelId.has(channelId)) {
        result.scanListIdByChannelId.set(channelId, scanListId);
      }
    }
  }

  return result;
}

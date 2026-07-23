/**
 * Build RadioWriteProjection from assemble + shared m×n expand for Web Serial Write.
 */

import type { AssembledBuild, LibrarySlice } from '@core/services/assemble.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { expandAllMxNChannels, expandMxNZoneMemberNumbers } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { filterExpandedRowsByOverrides } from '@core/domain/formatBuildOverrides.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { getProfileExportLimits } from '@core/import-export/profileExportLimits.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
import {
  getRadioIoProfile,
  isRadioIoDm32uvProfile,
} from '@core/import-export/formats/radio-io/profiles.ts';
import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import {
  DEFAULT_SCAN_CARRIER_HZ,
  zoneScanCarrierWireName,
} from '@core/import-export/zoneDerivedScanLists/carrier.ts';
import {
  layoutEntry,
  scanMasterEnabled,
  scanMemberIds,
} from '@core/import-export/zoneDerivedScanLists/members.ts';
import { DM32_EMPTY_SCAN_LIST_NAME } from '@core/import-export/zoneDerivedScanLists/derive.ts';
import { buildScanContext, effectiveScanSkips } from '@core/import-export/scanInclusion/index.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import type {
  RadioScanListDto,
  RadioWriteProjection,
  RadioZoneDto,
} from '@integrations/radio-io/radioWriteProjection.ts';
import {
  expandAssembledChannelsToRadioDtos,
  type RadioWireEgressIds,
} from './radioIoChannelMap.ts';

function buildNumbersBySourceChannelId(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: Pick<LibrarySlice, 'talkGroups' | 'digitalContacts'>,
  egress: RadioWireEgressIds,
  warnings: string[],
  maxSlots: number | undefined,
): Map<string, number[]> {
  const map = new Map<string, number[]>();

  if (!hasMxNChannelExpansion(build.radioTargetId)) {
    let autoSlot = 1;
    for (const row of assembled.channels) {
      const rxHz = row.entity.rxFrequency;
      if (rxHz == null || rxHz <= 0) continue;
      const slot = row.orderOrSlot != null && row.orderOrSlot > 0 ? row.orderOrSlot : autoSlot;
      if (maxSlots != null && slot > maxSlots) continue;
      const list = map.get(row.entity.id) ?? [];
      list.push(slot);
      map.set(row.entity.id, list);
      if (row.orderOrSlot == null || row.orderOrSlot <= 0) autoSlot += 1;
    }
    return map;
  }

  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const expanded = filterExpandedRowsByOverrides(
    expandAllMxNChannels({
      assembled,
      library,
      radioTargetId: build.radioTargetId,
      options: merged,
      warnings,
    }),
    build.channelOverrides,
  );

  const channelById = new Map(assembled.channels.map((row) => [row.entity.id, row.entity]));
  let slotIndex = 1;
  for (const projection of expanded) {
    const channel = channelById.get(projection.sourceChannelId);
    if (!channel) continue;
    const rxHz = channel.rxFrequency;
    if (rxHz == null || rxHz <= 0) continue;
    if (maxSlots != null && slotIndex > maxSlots) break;
    const list = map.get(projection.sourceChannelId) ?? [];
    list.push(slotIndex);
    map.set(projection.sourceChannelId, list);
    slotIndex += 1;
  }
  return map;
}

function nextFreeSlot(numbersBySource: Map<string, number[]>): number {
  let max = 0;
  for (const nums of numbersBySource.values()) {
    for (const n of nums) max = Math.max(max, n);
  }
  return max + 1;
}

function buildDm32Organisation(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: LibrarySlice,
  egress: RadioWireEgressIds,
  numbersBySourceChannelId: Map<string, number[]>,
  channels: RadioChannelDto[],
  warnings: string[],
): {
  zones: RadioZoneDto[];
  scanLists: RadioScanListDto[];
  channels: RadioChannelDto[];
  numbersBySourceChannelId: Map<string, number[]>;
} {
  const profile = getRadioIoProfile(egress.profileId);
  if (!isRadioIoDm32uvProfile(profile)) {
    return { zones: [], scanLists: [], channels, numbersBySourceChannelId };
  }

  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const reservedZoneNames = new Set<string>();
  const reservedScanNames = new Set<string>();
  const reservedCarrierNames = new Set(channels.map((c) => c.wireName));
  const carrierNumberByZoneId = new Map<string, number>();
  const scanListIdByChannelNumber = new Map<number, number>();
  const nextChannels = [...channels];
  const numbers = new Map(numbersBySourceChannelId);

  const zones: RadioZoneDto[] = [];
  const scanLists: RadioScanListDto[] = [];

  const zoneById = new Map(library.zones.map((z) => [z.id, z]));
  const channelById = new Map(library.channels.map((c) => [c.id, c]));
  const exportedChannelIds = new Set(assembled.channels.map((r) => r.entity.id));
  const layout = assembled.zoneGrouping;
  const scanContext = buildScanContext(
    merged.defaultScanInclusion != null
      ? { defaultScanInclusion: merged.defaultScanInclusion }
      : undefined,
    { defaultScanInclusion: 'scan' },
  );
  const masterOn = scanMasterEnabled(merged);

  for (const zone of assembled.zones) {
    if (zones.length >= profile.maxZones) break;

    let channelNumbers = expandMxNZoneMemberNumbers(zone.memberChannelIds, numbers);
    const entry = layoutEntry(layout, zone.zoneId);
    const wantScan = masterOn && (entry?.exportScanList ?? false);

    if (wantScan && scanLists.length < profile.maxScanLists) {
      const libraryZone = zoneById.get(zone.zoneId);
      if (libraryZone) {
        const memberIds = scanMemberIds(libraryZone, library.zones, {
          context: merged.zoneBehaviourContext,
          layoutEntry: entry,
        }).filter((id) => {
          if (!exportedChannelIds.has(id)) return false;
          const nums = numbers.get(id);
          if (nums == null || nums.length === 0) return false;
          const ch = channelById.get(id);
          return ch != null && !effectiveScanSkips(ch, scanContext);
        });

        let scanMembers = expandMxNZoneMemberNumbers(memberIds, numbers);
        if (scanMembers.length > profile.scanListMembers) {
          warnings.push(
            `Zone "${zone.wireName}" scan list truncated from ${scanMembers.length} to ${profile.scanListMembers} members`,
          );
          scanMembers = scanMembers.slice(0, profile.scanListMembers);
        }

        if (scanMembers.length > 0) {
          const carrierHz = entry?.scanCarrierFrequencyHz ?? DEFAULT_SCAN_CARRIER_HZ;
          const carrierName = zoneScanCarrierWireName(
            zone.wireName,
            profile.id,
            reservedCarrierNames,
            warnings,
          );
          reservedCarrierNames.add(carrierName);
          const carrierSlot = nextFreeSlot(numbers);
          if (carrierSlot <= profile.maxMemorySlots) {
            carrierNumberByZoneId.set(zone.zoneId, carrierSlot);
            nextChannels.push({
              slotIndex: carrierSlot,
              empty: false,
              wireName: carrierName,
              rxHz: carrierHz,
              txHz: carrierHz,
              rxTone: { kind: 'none' },
              txTone: { kind: 'none' },
              powerPercent: null,
              bandwidth: 'FM',
              mode: 'analog',
              scanListId: scanLists.length + 1,
              scanAdd: true,
            });
            // synthetic id map — carrier not in library
            numbers.set(`scan-carrier:${zone.zoneId}`, [carrierSlot]);

            const scanName = applyListWireNameLimits(
              zone.wireName,
              reservedScanNames,
              merged,
              profile.id,
              warnings,
              'Scan list',
              10,
            );
            const listIndex = scanLists.length + 1;
            scanLists.push({
              wireName: scanName,
              channelNumbers: scanMembers,
              designatedTxChannel: carrierSlot,
              listIndex,
            });
            for (const n of scanMembers) {
              scanListIdByChannelNumber.set(n, listIndex);
            }
            scanListIdByChannelNumber.set(carrierSlot, listIndex);
          }
        }
      }
    }

    const carrierNum = carrierNumberByZoneId.get(zone.zoneId);
    if (carrierNum != null) {
      channelNumbers = [carrierNum, ...channelNumbers.filter((n) => n !== carrierNum)];
    }
    if (channelNumbers.length > profile.zoneMembers) {
      warnings.push(
        `Zone "${zone.wireName}" truncated from ${channelNumbers.length} to ${profile.zoneMembers} members`,
      );
      channelNumbers = channelNumbers.slice(0, profile.zoneMembers);
    }

    const wireName = applyListWireNameLimits(
      zone.wireName,
      reservedZoneNames,
      merged,
      profile.id,
      warnings,
      'Zone',
      profile.nameLimit,
    );

    zones.push({ wireName, channelNumbers });
  }

  // Empty scan floor (#564)
  if (scanLists.length === 0) {
    const firstCh = nextChannels.find((c) => !c.empty)?.slotIndex;
    scanLists.push({
      wireName: DM32_EMPTY_SCAN_LIST_NAME,
      channelNumbers: firstCh != null ? [firstCh] : [],
      listIndex: 1,
    });
  }

  // Stamp scanListId on channel DTOs where derived
  const stamped = nextChannels.map((ch) => {
    const id = scanListIdByChannelNumber.get(ch.slotIndex);
    if (id == null) return ch;
    return { ...ch, scanListId: id, scanAdd: ch.scanAdd ?? true };
  });

  return {
    zones,
    scanLists,
    channels: stamped,
    numbersBySourceChannelId: numbers,
  };
}

/**
 * Assemble → channel DTOs + source→number map + organisation (zones/scan for DM-32).
 */
export function buildRadioWriteProjection(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: LibrarySlice,
  egress: RadioWireEgressIds,
): RadioWriteProjection {
  const { dtos, warnings } = expandAssembledChannelsToRadioDtos(
    assembled,
    build,
    library,
    egress,
  );
  const limits = getProfileExportLimits(egress.formatId as FormatId, egress.profileId);
  let numbersBySourceChannelId = buildNumbersBySourceChannelId(
    assembled,
    build,
    library,
    egress,
    warnings,
    limits?.maxChannels,
  );

  let channels = dtos;
  let organisation: RadioWriteProjection['organisation'] = {};

  if (egress.profileId === 'radio-io-dm32uv') {
    const org = buildDm32Organisation(
      assembled,
      build,
      library,
      egress,
      numbersBySourceChannelId,
      [...dtos],
      warnings,
    );
    channels = org.channels;
    numbersBySourceChannelId = org.numbersBySourceChannelId;
    organisation = { zones: org.zones, scanLists: org.scanLists };
  }

  return {
    channels,
    organisation,
    numbersBySourceChannelId,
    warnings,
  };
}

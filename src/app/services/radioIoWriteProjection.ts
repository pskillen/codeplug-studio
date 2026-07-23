/**
 * Build RadioWriteProjection from assemble + shared m×n expand for Web Serial Write.
 */

import type { AssembledBuild, LibrarySlice } from '@core/services/assemble.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import {
  expandAllMxNChannels,
  expandMxNZoneMemberNumbers,
} from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { filterExpandedRowsByOverrides } from '@core/domain/formatBuildOverrides.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import {
  getProfileExportLimits,
  type ProfileExportLimits,
} from '@core/import-export/profileExportLimits.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
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
  RadioAprsDto,
  RadioDigitalContactDto,
  RadioRxGroupDto,
  RadioScanListDto,
  RadioTalkGroupDto,
  RadioWriteProjection,
  RadioZoneDto,
} from '@integrations/radio-io/radioWriteProjection.ts';
import { buildNeonplugAprsRadioSettingsPatch } from '@core/services/aprsExportFacts.ts';
import {
  expandAssembledChannelsToRadioDtos,
  type RadioChannelFkMaps,
  type RadioWireEgressIds,
} from './radioIoChannelMap.ts';

/** NeonPlug quick-contact group-call type byte. */
const TG_CALL_TYPE_GROUP = 0x04;

function numericLimit(
  value: ProfileExportLimits[keyof ProfileExportLimits] | undefined,
  fallback: number,
): number {
  return typeof value === 'number' ? value : fallback;
}

/** DM-32UV wire caps via allowed app→core limits API (not format adapter imports). */
function dm32ExportLimits(egress: RadioWireEgressIds): ProfileExportLimits {
  return (
    getProfileExportLimits(egress.formatId as FormatId, egress.profileId) ?? {
      formatId: egress.formatId as FormatId,
      profileId: egress.profileId,
      profileLabel: 'DM-32UV',
      maxChannels: 4000,
      maxZones: 250,
      maxScanLists: 32,
      maxRxGroupLists: 250,
      maxContacts: null,
      maxTalkGroups: null,
      zoneMembers: 64,
      scanListMembers: 15,
      rxGroupListMembers: 32,
      nameLengthChannel: 16,
      nameLengthZone: 16,
      nameLengthContact: 16,
      nameLengthTalkGroup: 16,
      nameLengthScanList: 10,
      nameLengthRxGroupList: 10,
      powerLadder: [],
      siblingLadders: [],
    }
  );
}

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
  const limits = dm32ExportLimits(egress);
  const maxZones = numericLimit(limits.maxZones, 250);
  const maxScanLists = numericLimit(limits.maxScanLists, 32);
  const scanListMembersCap = numericLimit(limits.scanListMembers, 15);
  const maxMemorySlots = numericLimit(limits.maxChannels, 4000);
  const zoneMembersCap = numericLimit(limits.zoneMembers, 64);
  const nameLengthZone = numericLimit(limits.nameLengthZone, 16);
  const nameLengthScanList = numericLimit(limits.nameLengthScanList, 10);

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
    if (zones.length >= maxZones) break;

    let channelNumbers = expandMxNZoneMemberNumbers(zone.memberChannelIds, numbers);
    const entry = layoutEntry(layout, zone.zoneId);
    const wantScan = masterOn && (entry?.exportScanList ?? false);

    if (wantScan && scanLists.length < maxScanLists) {
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
        if (scanMembers.length > scanListMembersCap) {
          warnings.push(
            `Zone "${zone.wireName}" scan list truncated from ${scanMembers.length} to ${scanListMembersCap} members`,
          );
          scanMembers = scanMembers.slice(0, scanListMembersCap);
        }

        if (scanMembers.length > 0) {
          const carrierHz = entry?.scanCarrierFrequencyHz ?? DEFAULT_SCAN_CARRIER_HZ;
          const carrierName = zoneScanCarrierWireName(
            zone.wireName,
            egress.profileId,
            reservedCarrierNames,
            warnings,
          );
          reservedCarrierNames.add(carrierName);
          const carrierSlot = nextFreeSlot(numbers);
          if (carrierSlot <= maxMemorySlots) {
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
              egress.profileId,
              warnings,
              'Scan list',
              nameLengthScanList,
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
    if (channelNumbers.length > zoneMembersCap) {
      warnings.push(
        `Zone "${zone.wireName}" truncated from ${channelNumbers.length} to ${zoneMembersCap} members`,
      );
      channelNumbers = channelNumbers.slice(0, zoneMembersCap);
    }

    const wireName = applyListWireNameLimits(
      zone.wireName,
      reservedZoneNames,
      merged,
      egress.profileId,
      warnings,
      'Zone',
      nameLengthZone,
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

function buildTalkGroupsAndRx(
  assembled: AssembledBuild,
  egress: RadioWireEgressIds,
  warnings: string[],
): {
  talkGroups: RadioTalkGroupDto[];
  rxGroups: RadioRxGroupDto[];
  digitalContacts: RadioDigitalContactDto[];
  fkMaps: RadioChannelFkMaps;
} {
  const limits = dm32ExportLimits(egress);
  const nameLen = numericLimit(limits.nameLengthTalkGroup, 16);
  const maxRx = numericLimit(limits.maxRxGroupLists, 250);
  const maxRxMembers = numericLimit(limits.rxGroupListMembers, 32);
  const contactIdByEntityId = new Map<string, number>();
  const talkGroups: RadioTalkGroupDto[] = [];
  const reservedTg = new Set<string>();

  for (const row of assembled.talkGroups) {
    if (talkGroups.length >= 800) break;
    const wireName = applyListWireNameLimits(
      row.wireName,
      reservedTg,
      undefined,
      egress.profileId,
      warnings,
      'Talk group',
      nameLen,
    );
    const index = talkGroups.length + 1;
    talkGroups.push({
      index,
      wireName,
      digitalId: row.entity.digitalId,
      callType: TG_CALL_TYPE_GROUP,
    });
    contactIdByEntityId.set(row.entity.id, index);
  }

  const digitalContacts: RadioDigitalContactDto[] = [];
  const reservedDc = new Set<string>();
  for (const row of assembled.digitalContacts) {
    if (digitalContacts.length >= 250) break;
    const wireName = applyListWireNameLimits(
      row.wireName,
      reservedDc,
      undefined,
      egress.profileId,
      warnings,
      'Digital contact',
      nameLen,
    );
    digitalContacts.push({
      wireName,
      digitalId: row.entity.digitalId,
      callsign: row.entity.callsign ?? '',
      city: row.entity.city ?? '',
      province: row.entity.state ?? '',
      country: row.entity.country ?? '',
      remark: row.entity.remarks ?? '',
    });
  }

  const rxGroupIndexById = new Map<string, number>();
  const rxGroups: RadioRxGroupDto[] = [];
  const reservedRx = new Set<string>();

  for (const row of assembled.rxGroupLists) {
    if (rxGroups.length >= maxRx) break;
    const wireName = applyListWireNameLimits(
      row.wireName,
      reservedRx,
      undefined,
      egress.profileId,
      warnings,
      'RX group list',
      10,
    );
    const memberDigitalIds: number[] = [];
    for (const member of row.entity.members) {
      if (memberDigitalIds.length >= maxRxMembers) break;
      if (member.ref.kind === 'talkGroup') {
        const tg = assembled.talkGroups.find((t) => t.entity.id === member.ref.id);
        if (tg) memberDigitalIds.push(tg.entity.digitalId);
      } else if (member.ref.kind === 'digitalContact') {
        const dc = assembled.digitalContacts.find((d) => d.entity.id === member.ref.id);
        if (dc) memberDigitalIds.push(dc.entity.digitalId);
      }
    }
    const index = rxGroups.length + 1;
    rxGroups.push({ index, wireName, memberDigitalIds });
    // Channel byte uses 0-based in some docs; NeonPlug RX group id is 1-based in channel field bits.
    // Studio channelCodec writes rxGroupIndex & 0x3f — use 1-based index matching NeonPlug.
    rxGroupIndexById.set(row.entity.id, index);
  }

  return {
    talkGroups,
    rxGroups,
    digitalContacts,
    fkMaps: { contactIdByEntityId, rxGroupIndexById },
  };
}

/**
 * Assemble → channel DTOs + source→number map + organisation (zones/scan/TG/RX for DM-32).
 */
/** Map NeonPlug APRS settings patch → radio-boundary APRS DTO. */
function radioAprsFromNeonplugPatch(
  assembled: AssembledBuild,
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>,
  warnings: string[],
): RadioAprsDto | null {
  const numberArrays = new Map<string, number[]>();
  for (const [id, nums] of numbersBySourceChannelId) {
    numberArrays.set(id, [...nums]);
  }
  const { patch, warnings: aprsWarnings } = buildNeonplugAprsRadioSettingsPatch(
    assembled,
    numberArrays,
  );
  warnings.push(...aprsWarnings);
  if (patch == null) return null;
  return {
    reportChannelNumbers: [
      patch.aprsReportChannel1,
      patch.aprsReportChannel2,
      patch.aprsReportChannel3,
      patch.aprsReportChannel4,
      patch.aprsReportChannel5,
      patch.aprsReportChannel6,
      patch.aprsReportChannel7,
      patch.aprsReportChannel8,
    ],
    scheduledSendTime: patch.aprsScheduledSendTime,
    manualBeacon: patch.aprsFixedBeacon,
    latitude: patch.latitude,
    latitudeHemisphere: patch.latitudeDirection,
    longitude: patch.longitude,
    longitudeHemisphere: patch.longitudeDirection,
    callType: patch.aprsCallType ? 1 : 0,
    uploadDmrId: patch.aprsUploadId,
  };
}

export function buildRadioWriteProjection(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: LibrarySlice,
  egress: RadioWireEgressIds,
): RadioWriteProjection {
  const warnings: string[] = [];
  let fkMaps: RadioChannelFkMaps | undefined;
  let talkGroups: RadioTalkGroupDto[] = [];
  let rxGroups: RadioRxGroupDto[] = [];
  let digitalContacts: RadioDigitalContactDto[] = [];

  if (egress.profileId === 'radio-io-dm32uv') {
    const tgRx = buildTalkGroupsAndRx(assembled, egress, warnings);
    talkGroups = tgRx.talkGroups;
    rxGroups = tgRx.rxGroups;
    digitalContacts = tgRx.digitalContacts;
    fkMaps = tgRx.fkMaps;
  }

  const { dtos, warnings: channelWarnings } = expandAssembledChannelsToRadioDtos(
    assembled,
    build,
    library,
    egress,
    fkMaps,
  );
  warnings.push(...channelWarnings);

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
    organisation = {
      zones: org.zones,
      scanLists: org.scanLists,
      talkGroups,
      rxGroups,
      digitalContacts,
      aprs: radioAprsFromNeonplugPatch(assembled, numbersBySourceChannelId, warnings),
    };
  }

  return {
    channels,
    organisation,
    numbersBySourceChannelId,
    warnings,
  };
}

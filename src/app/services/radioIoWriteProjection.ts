/**
 * Build RadioWriteProjection from assemble + shared m×n expand for Web Serial Write.
 */

import type { Channel, ChannelModeProfile } from '@core/models/library.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { AssembledBuild, LibrarySlice } from '@core/services/assemble.ts';
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
  buildTalkGroupTimeslotCloneIndex,
  profileHasTalkGroupTimeslotClones,
  talkGroupSlotKey,
} from '@core/import-export/channelExpansion/talkGroupTimeslotClones.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
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
import {
  buildScanContext,
  effectiveScanSkips,
  resolveChannelScanInclusionForExport,
} from '@core/import-export/scanInclusion/index.ts';
import { getFormatExportDefaults } from '@core/import-export/registry.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import type {
  RadioAprsDto,
  RadioDigitalContactDto,
  RadioRadioIdDto,
  RadioRxGroupDto,
  RadioScanListDto,
  RadioTalkGroupDto,
  RadioWriteProjection,
  RadioZoneDto,
} from '@integrations/radio-io/radioWriteProjection.ts';
import { buildNeonplugAprsRadioSettingsPatch } from '@core/services/aprsExportFacts.ts';
import {
  partitionAnytoneChannels,
  partitionAnytoneZones,
} from '@core/services/anytoneChannelBanks.ts';
import {
  expandAssembledChannelsToRadioDtos,
  isOpenGd77RadioIoEgress,
  openGd77NumbersBySourceChannelId,
  type RadioChannelFkMaps,
  type RadioWireEgressIds,
} from './radioIoChannelMap.ts';

/** NeonPlug quick-contact group-call type byte (DM-32UV always writes group call). */
const TG_CALL_TYPE_GROUP = 0x04;

/** Tier-3 DM-32UV caps — contacts / quick-contact talk groups / operator radio IDs. */
const DM32_DEFAULT_MAX_TALK_GROUPS = 800;
const DM32_DEFAULT_MAX_DIGITAL_CONTACTS = 250;
const DM32_DEFAULT_MAX_RADIO_IDS = 250;

function numericLimit(
  value: ProfileExportLimits[keyof ProfileExportLimits] | undefined,
  fallback: number,
): number {
  return typeof value === 'number' ? value : fallback;
}

/** Radio-io profile caps via allowed app→core limits API. */
function radioIoExportLimits(egress: RadioWireEgressIds): ProfileExportLimits {
  return (
    getProfileExportLimits(egress.formatId as FormatId, egress.profileId) ?? {
      formatId: egress.formatId as FormatId,
      profileId: egress.profileId,
      profileLabel: 'Radio I/O',
      maxChannels: 4000,
      maxZones: 250,
      maxScanLists: 32,
      maxRxGroupLists: 32,
      maxContacts: DM32_DEFAULT_MAX_DIGITAL_CONTACTS,
      maxTalkGroups: DM32_DEFAULT_MAX_TALK_GROUPS,
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

/** @deprecated use {@link radioIoExportLimits} */
function dm32ExportLimits(egress: RadioWireEgressIds): ProfileExportLimits {
  return radioIoExportLimits(egress);
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
    if (isOpenGd77RadioIoEgress(egress.profileId)) {
      return openGd77NumbersBySourceChannelId(
        assembled.channels,
        build,
        egress,
        warnings,
        maxSlots,
      );
    }
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
  scanListWireCap?: number,
): {
  zones: RadioZoneDto[];
  scanLists: RadioScanListDto[];
  channels: RadioChannelDto[];
  numbersBySourceChannelId: Map<string, number[]>;
} {
  const limits = radioIoExportLimits(egress);
  const maxZones = numericLimit(limits.maxZones, 250);
  const maxScanLists =
    scanListWireCap ??
    Math.min(numericLimit(limits.maxScanLists, 32), DM32UV_LIMITS.CHANNEL_SCAN_LIST_ID_MAX);
  const scanListMembersCap = numericLimit(limits.scanListMembers, 15);
  const maxMemorySlots = numericLimit(limits.maxChannels, 4000);
  const zoneMembersCap = numericLimit(limits.zoneMembers, 64);
  const nameLengthZone = numericLimit(limits.nameLengthZone, 16);
  const nameLengthScanList = numericLimit(limits.nameLengthScanList, 10);
  /** Slots reserved for zone scan carriers — never steal their scanListId via shared members. */
  const carrierSlots = new Set<number>();

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

    if (wantScan && scanLists.length >= maxScanLists) {
      if (!warnings.some((w) => w.includes('channel scanListId supports at most'))) {
        warnings.push(
          `Additional zone-derived scan list(s) skipped; channel scanListId supports at most ${maxScanLists} lists`,
        );
      }
    } else if (wantScan) {
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
            carrierSlots.add(carrierSlot);
            const listIndex = scanLists.length + 1;
            nextChannels.push({
              slotIndex: carrierSlot,
              empty: false,
              wireName: carrierName,
              rxHz: carrierHz,
              txHz: carrierHz,
              rxTone: { kind: 'none' },
              txTone: { kind: 'none' },
              powerPercent: null,
              bandwidth: 'NFM',
              mode: 'analog',
              scanListId: listIndex,
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
            scanLists.push({
              wireName: scanName,
              channelNumbers: scanMembers,
              designatedTxChannel: carrierSlot,
              listIndex,
            });
            // First-wins for shared members (NeonPlug parity) — do not clobber carriers.
            for (const n of scanMembers) {
              if (carrierSlots.has(n)) continue;
              if (!scanListIdByChannelNumber.has(n)) {
                scanListIdByChannelNumber.set(n, listIndex);
              }
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
  const limits = radioIoExportLimits(egress);
  const nameLen = numericLimit(limits.nameLengthTalkGroup, 16);
  const maxTalkGroups = numericLimit(limits.maxTalkGroups, DM32_DEFAULT_MAX_TALK_GROUPS);
  const maxDigitalContacts =
    egress.profileId === 'radio-io-at-d890uv' || limits.maxContacts === 'not_used'
      ? 0
      : numericLimit(limits.maxContacts, DM32_DEFAULT_MAX_DIGITAL_CONTACTS);
  const maxRx = numericLimit(limits.maxRxGroupLists, 32);
  const maxRxMembers = numericLimit(limits.rxGroupListMembers, 32);
  const contactIdByEntityId = new Map<string, number>();
  const talkGroups: RadioTalkGroupDto[] = [];
  const reservedTg = new Set<string>();
  const talkGroupTotal = assembled.talkGroups.length;

  for (const row of assembled.talkGroups) {
    if (talkGroups.length >= maxTalkGroups) break;
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
  if (talkGroupTotal > maxTalkGroups) {
    warnings.push(
      `Build has ${talkGroupTotal} talk group(s); only ${maxTalkGroups} export to radio quick contacts`,
    );
  }

  const digitalContacts: RadioDigitalContactDto[] = [];
  const reservedDc = new Set<string>();
  const digitalContactTotal = assembled.digitalContacts.length;
  for (const row of assembled.digitalContacts) {
    if (digitalContacts.length >= maxDigitalContacts) break;
    const wireName = applyListWireNameLimits(
      row.wireName,
      reservedDc,
      undefined,
      egress.profileId,
      warnings,
      'Contact',
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
  if (digitalContactTotal > maxDigitalContacts) {
    warnings.push(
      `Build has ${digitalContactTotal} digital contact(s); only ${maxDigitalContacts} export to radio address book`,
    );
  }

  const rxGroupIndexById = new Map<string, number>();
  const rxGroups: RadioRxGroupDto[] = [];
  const reservedRx = new Set<string>();
  const rxGroupTotal = assembled.rxGroupLists.length;

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
    const useTalkgroupBankSlots = egress.profileId === 'radio-io-at-d890uv';
    for (const member of row.entity.members) {
      if (memberDigitalIds.length >= maxRxMembers) break;
      if (member.ref.kind === 'talkGroup') {
        if (useTalkgroupBankSlots) {
          const bankIndex = contactIdByEntityId.get(member.ref.id);
          if (bankIndex != null) memberDigitalIds.push(bankIndex - 1);
        } else {
          const tg = assembled.talkGroups.find((t) => t.entity.id === member.ref.id);
          if (tg) memberDigitalIds.push(tg.entity.digitalId);
        }
      } else if (!useTalkgroupBankSlots && member.ref.kind === 'digitalContact') {
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
  if (rxGroupTotal > maxRx) {
    warnings.push(
      `Build has ${rxGroupTotal} RX group list(s); only ${maxRx} export to radio RX group lists`,
    );
  }

  return {
    talkGroups,
    rxGroups,
    digitalContacts,
    fkMaps: { contactIdByEntityId, rxGroupIndexById },
  };
}

function isDmrProfile(
  profile: ChannelModeProfile,
): profile is Extract<ChannelModeProfile, { mode: 'dmr' }> {
  return profile.mode === 'dmr';
}

function buildDm32RadioIdBank(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: Pick<LibrarySlice, 'talkGroups' | 'digitalContacts'>,
  egress: RadioWireEgressIds,
  warnings: string[],
): { radioIds: RadioRadioIdDto[]; dmrIdIndexByValue: Map<number, number> } {
  const limits = dm32ExportLimits(egress);
  const maxRadioIds = numericLimit(limits.maxContacts, DM32_DEFAULT_MAX_RADIO_IDS);
  const seen = new Map<number, { dmrId: number; name: string }>();

  const considerDmrId = (dmrId: number | null | undefined, channel: Channel) => {
    if (dmrId == null || dmrId <= 0 || seen.has(dmrId)) return;
    const label = channel.callsign?.trim() || channel.name?.trim() || 'Radio ID';
    seen.set(dmrId, { dmrId, name: label.slice(0, 11) });
  };

  for (const row of assembled.channels) {
    for (const profile of row.entity.modeProfiles) {
      if (isDmrProfile(profile)) {
        considerDmrId(profile.dmrId, row.entity);
      }
    }
  }

  if (hasMxNChannelExpansion(build.radioTargetId)) {
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
    for (const projection of expanded) {
      const channel = channelById.get(projection.sourceChannelId);
      if (!channel || !isDmrProfile(projection.modeProfile)) continue;
      considerDmrId(projection.modeProfile.dmrId, channel);
    }
  }

  const entries = [...seen.values()];
  if (entries.length > maxRadioIds) {
    warnings.push(
      `Build has ${entries.length} distinct DMR radio ID(s); only ${maxRadioIds} export to operator radio-ID bank`,
    );
  }
  const capped = entries.slice(0, maxRadioIds);
  const radioIds = capped.map((entry, index) => ({ index, ...entry }));
  const dmrIdIndexByValue = new Map(capped.map((entry, index) => [entry.dmrId, index]));
  return { radioIds, dmrIdIndexByValue };
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

function openGd77ExportLimits(egress: RadioWireEgressIds): ProfileExportLimits {
  return (
    getProfileExportLimits(egress.formatId as FormatId, egress.profileId) ?? {
      formatId: egress.formatId as FormatId,
      profileId: egress.profileId,
      profileLabel: 'OpenGD77 1701',
      maxChannels: 1023,
      maxZones: 68,
      maxScanLists: 'not_used',
      maxRxGroupLists: 76,
      maxContacts: null,
      maxTalkGroups: null,
      zoneMembers: 80,
      scanListMembers: 'not_used',
      rxGroupListMembers: 32,
      nameLengthChannel: 16,
      nameLengthZone: 16,
      nameLengthContact: 16,
      nameLengthTalkGroup: 16,
      nameLengthScanList: 'not_used',
      nameLengthRxGroupList: 15,
      powerLadder: [],
      siblingLadders: [],
    }
  );
}

/**
 * OpenGD77 lean organisation: contacts + RX groups + zones.
 * Channels stay 1:1 with library (no m×n fan-out) — Contact / TG List FKs on the channel record.
 */
function buildOpenGd77ContactsAndRx(
  assembled: AssembledBuild,
  egress: RadioWireEgressIds,
  warnings: string[],
): {
  talkGroups: RadioTalkGroupDto[];
  rxGroups: RadioRxGroupDto[];
  digitalContacts: RadioDigitalContactDto[];
  fkMaps: RadioChannelFkMaps;
} {
  const limits = openGd77ExportLimits(egress);
  const nameLen = numericLimit(limits.nameLengthTalkGroup, 16);
  const nameLenRx = numericLimit(limits.nameLengthRxGroupList, 15);
  const maxRx = numericLimit(limits.maxRxGroupLists, 76);
  const maxRxMembers = numericLimit(limits.rxGroupListMembers, 32);
  const maxContacts = 1024;

  const contactIdByEntityId = new Map<string, number>();
  const contactIndexByTalkGroupSlot = new Map<string, number>();
  const talkGroups: RadioTalkGroupDto[] = [];
  const reservedTg = new Set<string>();

  const baseWireNames = new Map<string, string>();
  for (const row of assembled.talkGroups) {
    baseWireNames.set(
      row.entity.id,
      applyListWireNameLimits(
        row.wireName,
        reservedTg,
        undefined,
        egress.profileId,
        warnings,
        'Talk group',
        nameLen,
      ),
    );
  }

  const useClones = profileHasTalkGroupTimeslotClones(egress.profileId);
  const cloneIndex = useClones
    ? buildTalkGroupTimeslotCloneIndex(assembled, baseWireNames, {
        maxNameLength: nameLen,
        reserved: reservedTg,
      })
    : null;

  if (cloneIndex) {
    for (const clone of cloneIndex.clones) {
      if (talkGroups.length >= maxContacts) break;
      const index = talkGroups.length + 1;
      talkGroups.push({
        index,
        wireName: clone.wireName,
        digitalId: clone.digitalId,
        callType: 0,
        timeSlotOverride: clone.slot,
      });
      contactIndexByTalkGroupSlot.set(talkGroupSlotKey(clone.talkGroupId, clone.slot), index);
    }
  } else {
    for (const row of assembled.talkGroups) {
      if (talkGroups.length >= maxContacts) break;
      const wireName = baseWireNames.get(row.entity.id) ?? row.wireName;
      const index = talkGroups.length + 1;
      talkGroups.push({
        index,
        wireName,
        digitalId: row.entity.digitalId,
        callType: 0,
      });
      contactIdByEntityId.set(row.entity.id, index);
    }
  }

  const digitalContacts: RadioDigitalContactDto[] = [];
  const reservedDc = new Set<string>();
  let nextContactIndex = talkGroups.length + 1;
  for (const row of assembled.digitalContacts) {
    if (nextContactIndex > maxContacts) break;
    const wireName = applyListWireNameLimits(
      row.wireName,
      reservedDc,
      undefined,
      egress.profileId,
      warnings,
      'Contact',
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
    contactIdByEntityId.set(row.entity.id, nextContactIndex);
    nextContactIndex++;
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
      nameLenRx,
    );
    const memberDigitalIds: number[] = [];
    for (const member of row.entity.members) {
      if (memberDigitalIds.length >= maxRxMembers) break;
      if (member.ref.kind === 'talkGroup') {
        if (cloneIndex) {
          const slot = cloneIndex.resolveRxMemberSlot(member.timeSlotOverride);
          const bankIdx = contactIndexByTalkGroupSlot.get(talkGroupSlotKey(member.ref.id, slot));
          if (bankIdx != null) memberDigitalIds.push(bankIdx);
        } else {
          const tg = assembled.talkGroups.find((t) => t.entity.id === member.ref.id);
          if (tg) memberDigitalIds.push(tg.entity.digitalId);
        }
      } else if (member.ref.kind === 'digitalContact') {
        if (cloneIndex) {
          const bankIdx = contactIdByEntityId.get(member.ref.id);
          if (bankIdx != null) memberDigitalIds.push(bankIdx);
        } else {
          const dc = assembled.digitalContacts.find((d) => d.entity.id === member.ref.id);
          if (dc) memberDigitalIds.push(dc.entity.digitalId);
        }
      }
    }
    const index = rxGroups.length + 1;
    rxGroups.push({ index, wireName, memberDigitalIds });
    rxGroupIndexById.set(row.entity.id, index - 1);
  }

  return {
    talkGroups,
    rxGroups,
    digitalContacts,
    fkMaps: {
      contactIdByEntityId,
      ...(contactIndexByTalkGroupSlot.size > 0 ? { contactIndexByTalkGroupSlot } : {}),
      rxGroupIndexById,
    },
  };
}

function buildOpenGd77Zones(
  assembled: AssembledBuild,
  egress: RadioWireEgressIds,
  numbersBySourceChannelId: Map<string, number[]>,
  warnings: string[],
): RadioZoneDto[] {
  const limits = openGd77ExportLimits(egress);
  const maxZones = numericLimit(limits.maxZones, 68);
  const zoneMembersCap = numericLimit(limits.zoneMembers, 80);
  const nameLengthZone = numericLimit(limits.nameLengthZone, 16);

  const reservedZoneNames = new Set<string>();
  const zones: RadioZoneDto[] = [];

  for (const zone of assembled.zones) {
    if (zones.length >= maxZones) break;
    let channelNumbers: number[] = [];
    for (const channelId of zone.memberChannelIds) {
      const nums = numbersBySourceChannelId.get(channelId);
      if (nums) channelNumbers.push(...nums);
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
      undefined,
      egress.profileId,
      warnings,
      'Zone',
      nameLengthZone,
    );
    zones.push({ wireName, channelNumbers });
  }
  return zones;
}

function stampUv17ProFlatMemoryChannelBehaviour(
  channels: RadioChannelDto[],
  assembled: AssembledBuild,
  build: RadioBuild,
  egress: RadioWireEgressIds,
  numbersBySourceChannelId: Map<string, number[]>,
): RadioChannelDto[] {
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const scanContext = buildScanContext(
    merged.defaultScanInclusion != null
      ? { defaultScanInclusion: merged.defaultScanInclusion }
      : undefined,
    getFormatExportDefaults(egress.formatId, egress.profileId),
  );

  const channelByNumber = new Map<number, (typeof assembled.channels)[number]>();
  for (const row of assembled.channels) {
    const nums = numbersBySourceChannelId.get(row.entity.id);
    if (!nums) continue;
    for (const n of nums) channelByNumber.set(n, row);
  }

  return channels.map((dto) => {
    const row = channelByNumber.get(dto.slotIndex);
    if (!row) return dto;
    const scanAdd =
      resolveChannelScanInclusionForExport(row.entity, row.scanInclusionOverride, scanContext) ===
      'scan';
    return { ...dto, scanAdd };
  });
}

function stampOpenGd77ChannelBehaviour(
  channels: RadioChannelDto[],
  assembled: AssembledBuild,
  build: RadioBuild,
  numbersBySourceChannelId: Map<string, number[]>,
  profileId: string,
): RadioChannelDto[] {
  const merged = mergeExportOptions(build, 'radio-io', { profileId });
  const scanContext = buildScanContext(
    merged.defaultScanInclusion != null
      ? { defaultScanInclusion: merged.defaultScanInclusion }
      : undefined,
    getFormatExportDefaults('radio-io', profileId),
  );

  const channelByNumber = new Map<number, (typeof assembled.channels)[number]>();
  for (const row of assembled.channels) {
    const nums = numbersBySourceChannelId.get(row.entity.id);
    if (!nums) continue;
    for (const n of nums) channelByNumber.set(n, row);
  }

  return channels.map((dto) => {
    const row = channelByNumber.get(dto.slotIndex);
    if (!row) return dto;
    const skip = effectiveScanSkips(row.entity, scanContext, row.scanInclusionOverride);
    const forbid = row.entity.forbidTransmit === 'forbid';
    return {
      ...dto,
      skipScan: skip,
      skipZoneScan: skip,
      rxOnly: forbid || dto.rxOnly,
    };
  });
}

/** DMR-bank-only assembled view for AT-D890UV serial Write (CSV parity for AM air / FM broadcast). */
function buildAtD890DmrBankAssembled(
  assembled: AssembledBuild,
  build: RadioBuild,
  egress: RadioWireEgressIds,
  warnings: string[],
): AssembledBuild {
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const context = merged.channelBehaviourContext;
  const { dmrChannels, amAirChannels, fmBroadcastChannels } = partitionAnytoneChannels(
    assembled,
    context,
  );

  if (amAirChannels.length > 0) {
    warnings.push(
      `${amAirChannels.length} AM airband channel(s) omitted from Web Serial Write — use Anytone CSV for AMAir.CSV updates; the radio's AM airband bank is unchanged.`,
    );
  }
  if (fmBroadcastChannels.length > 0) {
    warnings.push(
      `${fmBroadcastChannels.length} broadcast FM channel(s) omitted from Web Serial Write — use Anytone CSV for FM.CSV updates.`,
    );
  }

  const dmrChannelIds = new Set(dmrChannels.map((row) => row.entity.id));
  const { dmrZones } = partitionAnytoneZones(assembled, context);
  const zoneById = new Map(assembled.zones.map((zone) => [zone.zoneId, zone]));
  const zones = dmrZones
    .map((partitioned) => {
      const original = zoneById.get(partitioned.zoneId);
      const memberChannelIds = partitioned.memberChannelIds.filter((id) => dmrChannelIds.has(id));
      return {
        zoneId: partitioned.zoneId,
        wireName: original?.wireName ?? partitioned.zoneId,
        memberChannelIds,
      };
    })
    .filter((zone) => zone.memberChannelIds.length > 0);

  return {
    ...assembled,
    channels: dmrChannels,
    zones,
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
  let dm32RadioIds: RadioRadioIdDto[] = [];

  if (egress.profileId === 'radio-io-dm32uv' || egress.profileId === 'radio-io-at-d890uv') {
    const tgRx = buildTalkGroupsAndRx(assembled, egress, warnings);
    talkGroups = tgRx.talkGroups;
    rxGroups = tgRx.rxGroups;
    digitalContacts = tgRx.digitalContacts;
    const radioIdBank = buildDm32RadioIdBank(assembled, build, library, egress, warnings);
    dm32RadioIds = radioIdBank.radioIds;
    fkMaps = {
      ...tgRx.fkMaps,
      dmrIdIndexByValue: radioIdBank.dmrIdIndexByValue,
    };
  } else if (isOpenGd77RadioIoEgress(egress.profileId)) {
    const tgRx = buildOpenGd77ContactsAndRx(assembled, egress, warnings);
    talkGroups = tgRx.talkGroups;
    rxGroups = tgRx.rxGroups;
    digitalContacts = tgRx.digitalContacts;
    fkMaps = tgRx.fkMaps;
  }

  const projectionAssembled =
    egress.profileId === 'radio-io-at-d890uv'
      ? buildAtD890DmrBankAssembled(assembled, build, egress, warnings)
      : assembled;

  const { dtos, warnings: channelWarnings } = expandAssembledChannelsToRadioDtos(
    projectionAssembled,
    build,
    library,
    egress,
    fkMaps,
  );
  warnings.push(...channelWarnings);

  const limits = getProfileExportLimits(egress.formatId as FormatId, egress.profileId);
  let numbersBySourceChannelId = buildNumbersBySourceChannelId(
    projectionAssembled,
    build,
    library,
    egress,
    warnings,
    typeof limits?.maxChannels === 'number' ? limits.maxChannels : undefined,
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
      radioIds: dm32RadioIds,
      aprs: radioAprsFromNeonplugPatch(assembled, numbersBySourceChannelId, warnings),
    };
  } else if (egress.profileId === 'radio-io-at-d890uv') {
    const d890Limits = radioIoExportLimits(egress);
    const org = buildDm32Organisation(
      projectionAssembled,
      build,
      library,
      egress,
      numbersBySourceChannelId,
      [...dtos],
      warnings,
      numericLimit(d890Limits.maxScanLists, 100),
    );
    channels = stampUv17ProFlatMemoryChannelBehaviour(
      org.channels,
      projectionAssembled,
      build,
      egress,
      org.numbersBySourceChannelId,
    );
    numbersBySourceChannelId = org.numbersBySourceChannelId;
    organisation = {
      zones: org.zones,
      scanLists: org.scanLists,
      talkGroups,
      rxGroups,
      radioIds: dm32RadioIds,
    };
  } else if (isOpenGd77RadioIoEgress(egress.profileId)) {
    channels = stampOpenGd77ChannelBehaviour(
      dtos,
      assembled,
      build,
      numbersBySourceChannelId,
      egress.profileId,
    );
    organisation = {
      zones: buildOpenGd77Zones(assembled, egress, numbersBySourceChannelId, warnings),
      talkGroups,
      rxGroups,
      digitalContacts,
    };
  } else if (
    egress.profileId === 'radio-io-uv5r-mini' ||
    egress.profileId === 'radio-io-uv21' ||
    egress.profileId === 'radio-io-rt95'
  ) {
    channels = stampUv17ProFlatMemoryChannelBehaviour(
      dtos,
      assembled,
      build,
      egress,
      numbersBySourceChannelId,
    );
  }

  return {
    channels,
    organisation,
    numbersBySourceChannelId,
    warnings,
  };
}

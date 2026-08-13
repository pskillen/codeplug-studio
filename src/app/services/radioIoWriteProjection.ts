/**
 * Build RadioWriteProjection from assemble + shared m×n expand for Web Serial Write.
 */

import type {
  DualBankRadioWriteOptions,
  DualBankWriteMode,
  SingleBankDigitalProjectionMode,
  SingleBankWriteMode,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import type { Channel, ChannelModeProfile } from '@core/models/library.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { AssembledBuild, LibrarySlice } from '@core/services/assemble.ts';
import type { DualBankDirectorySlice } from './dualBankRadioWrite.ts';
import {
  expandAllMxNChannels,
  expandMxNZoneMemberNumbers,
} from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { mxnSiteWireNameResolverForRadioTarget } from '@core/services/anytoneChannelExpansion.ts';
import { filterExpandedRowsByOverrides } from '@core/domain/formatBuildOverrides.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import {
  getProfileExportLimits,
  type ProfileExportLimits,
} from '@core/import-export/profileExportLimits.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import { buildDigitalContactExportWireNameMap } from '@core/import-export/digitalContactExportName.ts';
import { applyTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
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
import { DM32_EMPTY_SCAN_LIST_NAME } from '@core/import-export/zoneDerivedScanLists/dm32EmptyScanFloor.ts';
import {
  buildScanContext,
  effectiveScanSkips,
  resolveChannelScanInclusionForExport,
} from '@core/import-export/scanInclusion/index.ts';
import { getFormatExportDefaults } from '@core/import-export/registry.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import type {
  RadioAmAirChannelDto,
  RadioAmZoneDto,
  RadioAprsDigitalSlotDto,
  RadioAprsDto,
  RadioDigitalContactDto,
  RadioRadioIdDto,
  RadioRxGroupDto,
  RadioScanListDto,
  RadioTalkGroupDto,
  RadioWriteProjection,
  RadioZoneDto,
} from '@integrations/radio-io/radioWriteProjection.ts';
import {
  buildNeonplugAprsRadioSettingsPatch,
  formatAnytonePositionSource,
} from '@core/services/aprsExportFacts.ts';
import {
  orderedAmAirChannels,
  partitionAnytoneChannels,
  partitionAnytoneZones,
  receiveBankChannelSlot,
} from '@core/services/anytoneChannelBanks.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { AT_D890_APRS_CURRENT_CHANNEL_WIRE } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import {
  expandAssembledChannelsToRadioDtos,
  isOpenGd77RadioIoEgress,
  openGd77NumbersBySourceChannelId,
  type RadioChannelFkMaps,
  type RadioWireEgressIds,
} from './radioIoChannelMap.ts';

/** NeonPlug quick-contact group-call type byte (DM-32UV always writes group call). */
const TG_CALL_TYPE_GROUP = 0x04;

class RadioIoExportLimitsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RadioIoExportLimitsError';
  }
}

function requireProfileExportLimits(egress: RadioWireEgressIds): ProfileExportLimits {
  const limits = getProfileExportLimits(egress.formatId as FormatId, egress.profileId);
  if (limits == null) {
    throw new RadioIoExportLimitsError(
      `Missing export limits for ${egress.formatId}/${egress.profileId}`,
    );
  }
  return limits;
}

function requireNumericLimit(
  value: ProfileExportLimits[keyof ProfileExportLimits] | undefined,
  field: string,
  egress: RadioWireEgressIds,
): number {
  if (typeof value === 'number') return value;
  if (value === 'not_used') {
    throw new RadioIoExportLimitsError(
      `Export limit ${field} is not used for ${egress.formatId}/${egress.profileId}`,
    );
  }
  throw new RadioIoExportLimitsError(
    `Missing export limit ${field} for ${egress.formatId}/${egress.profileId}`,
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
      resolveSiteWireName: mxnSiteWireNameResolverForRadioTarget(build.radioTargetId),
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
  const limits = requireProfileExportLimits(egress);
  const maxZones = requireNumericLimit(limits.maxZones, 'maxZones', egress);
  const maxScanLists =
    scanListWireCap ??
    Math.min(
      requireNumericLimit(limits.maxScanLists, 'maxScanLists', egress),
      DM32UV_LIMITS.CHANNEL_SCAN_LIST_ID_MAX,
    );
  const scanListMembersCap = requireNumericLimit(limits.scanListMembers, 'scanListMembers', egress);
  const maxMemorySlots = requireNumericLimit(limits.maxChannels, 'maxChannels', egress);
  const zoneMembersCap = requireNumericLimit(limits.zoneMembers, 'zoneMembers', egress);
  const nameLengthZone = requireNumericLimit(limits.nameLengthZone, 'nameLengthZone', egress);
  const nameLengthScanList = requireNumericLimit(
    limits.nameLengthScanList,
    'nameLengthScanList',
    egress,
  );
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
              Boolean(zone.wireNameOverride?.trim()),
            );
            scanLists.push({
              wireName: scanName,
              channelNumbers: scanMembers,
              designatedTxChannel: carrierSlot,
              listIndex,
            });
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
      Boolean(zone.wireNameOverride?.trim()),
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

export interface BuildRadioWriteProjectionContext {
  dualBank?: {
    mode: DualBankWriteMode;
    options: DualBankRadioWriteOptions;
    directorySlice?: DualBankDirectorySlice;
  };
  singleBank?: {
    mode: SingleBankWriteMode;
    projectionMode: SingleBankDigitalProjectionMode;
    digitalContacts?: RadioDigitalContactDto[] | undefined;
  };
}

function buildTalkGroupsAndRx(
  assembled: AssembledBuild,
  build: RadioBuild,
  egress: RadioWireEgressIds,
  warnings: string[],
  includeLibraryContacts = true,
): {
  talkGroups: RadioTalkGroupDto[];
  rxGroups: RadioRxGroupDto[];
  digitalContacts: RadioDigitalContactDto[];
  fkMaps: RadioChannelFkMaps;
} {
  const limits = requireProfileExportLimits(egress);
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const nameLen = requireNumericLimit(limits.nameLengthTalkGroup, 'nameLengthTalkGroup', egress);
  const maxTalkGroups = requireNumericLimit(limits.maxTalkGroups, 'maxTalkGroups', egress);
  const maxDigitalContacts =
    egress.profileId === 'radio-io-at-d890uv' || limits.maxContacts === 'not_used'
      ? 0
      : requireNumericLimit(limits.maxContacts, 'maxContacts', egress);
  const maxRx = requireNumericLimit(limits.maxRxGroupLists, 'maxRxGroupLists', egress);
  const maxRxMembers = requireNumericLimit(limits.rxGroupListMembers, 'rxGroupListMembers', egress);
  const nameLenRx = requireNumericLimit(
    limits.nameLengthRxGroupList,
    'nameLengthRxGroupList',
    egress,
  );
  const contactIdByEntityId = new Map<string, number>();
  const talkGroups: RadioTalkGroupDto[] = [];
  const reservedTg = new Set<string>();
  const talkGroupTotal = assembled.talkGroups.length;

  for (const row of assembled.talkGroups) {
    if (talkGroups.length >= maxTalkGroups) break;
    const wireName = applyTalkGroupWireNameLimits(
      row.wireName,
      row.entity,
      reservedTg,
      merged,
      egress.profileId,
      warnings,
      nameLen,
      Boolean(row.wireNameOverride?.trim()),
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
  const contactExportWireNames = buildDigitalContactExportWireNameMap(
    assembled.digitalContacts,
    build.contactOverrides,
    merged,
    egress.profileId,
    warnings,
  );
  if (includeLibraryContacts) {
    for (const row of assembled.digitalContacts) {
      if (digitalContacts.length >= maxDigitalContacts) break;
      const wireName = applyListWireNameLimits(
        contactExportWireNames.get(row.entity.id) ?? row.wireName,
        reservedDc,
        merged,
        egress.profileId,
        warnings,
        'Contact',
        nameLen,
        Boolean(row.wireNameOverride?.trim()),
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
      merged,
      egress.profileId,
      warnings,
      'RX group list',
      nameLenRx,
      Boolean(row.wireNameOverride?.trim()),
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

function mergeDm32RadioIdEntries(
  channelEntries: readonly { dmrId: number; name: string }[],
  directoryRadioIds: readonly RadioRadioIdDto[],
  maxRadioIds: number,
  mode: DualBankWriteMode,
  warnings: string[],
): { radioIds: RadioRadioIdDto[]; dmrIdIndexByValue: Map<number, number> } {
  const seen = new Map<number, { dmrId: number; name: string }>();

  const consider = (dmrId: number, name: string) => {
    if (dmrId <= 0 || seen.has(dmrId)) return;
    seen.set(dmrId, { dmrId, name: name.slice(0, 11) });
  };

  if (mode === 'codeplug') {
    for (const entry of channelEntries) {
      consider(entry.dmrId, entry.name);
    }
  }
  for (const entry of directoryRadioIds) {
    consider(entry.dmrId, entry.name);
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

function buildDm32RadioIdBank(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: Pick<LibrarySlice, 'talkGroups' | 'digitalContacts'>,
  egress: RadioWireEgressIds,
  warnings: string[],
  mode: DualBankWriteMode,
  directoryRadioIds: readonly RadioRadioIdDto[],
): { radioIds: RadioRadioIdDto[]; dmrIdIndexByValue: Map<number, number> } {
  const limits = requireProfileExportLimits(egress);
  const maxRadioIds = requireNumericLimit(limits.maxRadioIds, 'maxRadioIds', egress);
  const channelEntries: { dmrId: number; name: string }[] = [];
  const seenChannel = new Set<number>();

  const considerChannelDmrId = (dmrId: number | null | undefined, channel: Channel) => {
    if (dmrId == null || dmrId <= 0 || seenChannel.has(dmrId)) return;
    seenChannel.add(dmrId);
    const label = channel.callsign?.trim() || channel.name?.trim() || 'Radio ID';
    channelEntries.push({ dmrId, name: label });
  };

  for (const row of assembled.channels) {
    for (const profile of row.entity.modeProfiles) {
      if (isDmrProfile(profile)) {
        considerChannelDmrId(profile.dmrId, row.entity);
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
        resolveSiteWireName: mxnSiteWireNameResolverForRadioTarget(build.radioTargetId),
      }),
      build.channelOverrides,
    );
    const channelById = new Map(assembled.channels.map((row) => [row.entity.id, row.entity]));
    for (const projection of expanded) {
      const channel = channelById.get(projection.sourceChannelId);
      if (!channel || !isDmrProfile(projection.modeProfile)) continue;
      considerChannelDmrId(projection.modeProfile.dmrId, channel);
    }
  }

  return mergeDm32RadioIdEntries(channelEntries, directoryRadioIds, maxRadioIds, mode, warnings);
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

function parseFixCoordinate(
  degrees: string,
  minInt: string,
  minMark: string,
  hemisphere: string,
): { degrees: number; minInt: number; minMark: number; hemisphere: 0 | 1 } {
  return {
    degrees: Number.parseInt(degrees, 10) || 0,
    minInt: Number.parseInt(minInt, 10) || 0,
    minMark: Number.parseInt(minMark, 10) || 0,
    hemisphere: (Number.parseInt(hemisphere, 10) === 1 ? 1 : 0) as 0 | 1,
  };
}

/** Map library `AprsConfiguration` → AT-D890UV global APRS block DTO. */
function radioAprsFromAnytoneLibrary(
  assembled: AssembledBuild,
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>,
  warnings: string[],
): RadioAprsDto | null {
  const config = assembled.aprsConfiguration;
  if (!config) return null;

  const dmrSlotByChannelId = new Map<string, number>();
  for (const [channelId, nums] of numbersBySourceChannelId) {
    if (nums[0] != null) dmrSlotByChannelId.set(channelId, nums[0]!);
  }

  const digitalSlots: RadioAprsDigitalSlotDto[] = [];
  const slots = (config.channelSlots ?? []).slice(0, AT_D890UV_LIMITS.APRS_SLOTS);
  for (const slot of slots) {
    let reportChannelWire = AT_D890_APRS_CURRENT_CHANNEL_WIRE;
    if (slot.channelRef != null) {
      const wire = dmrSlotByChannelId.get(slot.channelRef.id);
      if (wire == null) {
        warnings.push(
          `APRS slot references channel "${slot.channelRef.id}" outside the DMR bank; encoding Current Channel on Web Serial Write`,
        );
      } else {
        reportChannelWire = wire;
      }
    }
    digitalSlots.push({
      reportChannelWire,
      targetDmrId: slot.targetDmrId,
      callType: slot.callType === 'private' ? 0 : 1,
      timeslot: slot.timeslot === 1 ? 1 : slot.timeslot === 2 ? 2 : 0,
    });
  }

  const position = formatAnytonePositionSource(config.positionSource, config.fixedLocation);
  const fixedLocationBeacon = position.fixedLocationBeacon === '1' ? 1 : 0;

  return {
    manualTxIntervalSec: config.manualTxIntervalSec,
    autoTxIntervalSec: config.autoTxIntervalSec,
    fixedLocationBeacon: fixedLocationBeacon as 0 | 1,
    ...(fixedLocationBeacon
      ? {
          fixedLatitude: parseFixCoordinate(
            position.latitude.degrees,
            position.latitude.minInt,
            position.latitude.minMark,
            position.latitude.hemisphere,
          ),
          fixedLongitude: parseFixCoordinate(
            position.longitude.degrees,
            position.longitude.minInt,
            position.longitude.minMark,
            position.longitude.hemisphere,
          ),
        }
      : {}),
    digitalSlots,
  };
}

function buildOpenGd77ContactsAndRx(
  assembled: AssembledBuild,
  build: RadioBuild,
  egress: RadioWireEgressIds,
  warnings: string[],
  includeLibraryContacts = true,
  directoryDigitalContacts: readonly RadioDigitalContactDto[] = [],
): {
  talkGroups: RadioTalkGroupDto[];
  rxGroups: RadioRxGroupDto[];
  digitalContacts: RadioDigitalContactDto[];
  fkMaps: RadioChannelFkMaps;
} {
  const limits = requireProfileExportLimits(egress);
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const nameLen = requireNumericLimit(limits.nameLengthTalkGroup, 'nameLengthTalkGroup', egress);
  const nameLenRx = requireNumericLimit(
    limits.nameLengthRxGroupList,
    'nameLengthRxGroupList',
    egress,
  );
  const maxRx = requireNumericLimit(limits.maxRxGroupLists, 'maxRxGroupLists', egress);
  const maxRxMembers = requireNumericLimit(limits.rxGroupListMembers, 'rxGroupListMembers', egress);
  const maxContacts = requireNumericLimit(limits.maxContacts, 'maxContacts', egress);

  const contactIdByEntityId = new Map<string, number>();
  const contactIndexByTalkGroupSlot = new Map<string, number>();
  const talkGroups: RadioTalkGroupDto[] = [];
  const reservedTg = new Set<string>();

  const baseWireNames = new Map<string, string>();
  for (const row of assembled.talkGroups) {
    baseWireNames.set(
      row.entity.id,
      applyTalkGroupWireNameLimits(
        row.wireName,
        row.entity,
        reservedTg,
        merged,
        egress.profileId,
        warnings,
        nameLen,
        Boolean(row.wireNameOverride?.trim()),
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
  const contactExportWireNames = buildDigitalContactExportWireNameMap(
    assembled.digitalContacts,
    build.contactOverrides,
    merged,
    egress.profileId,
    warnings,
  );
  if (includeLibraryContacts) {
    for (const row of assembled.digitalContacts) {
      if (nextContactIndex > maxContacts) break;
      const wireName = applyListWireNameLimits(
        contactExportWireNames.get(row.entity.id) ?? row.wireName,
        reservedDc,
        merged,
        egress.profileId,
        warnings,
        'Contact',
        nameLen,
        Boolean(row.wireNameOverride?.trim()),
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
  }
  for (const directoryContact of directoryDigitalContacts) {
    if (nextContactIndex > maxContacts) break;
    const wireName = applyListWireNameLimits(
      directoryContact.wireName,
      reservedDc,
      merged,
      egress.profileId,
      warnings,
      'Contact',
      nameLen,
      false,
    );
    digitalContacts.push({ ...directoryContact, wireName });
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
      merged,
      egress.profileId,
      warnings,
      'RX group list',
      nameLenRx,
      Boolean(row.wireNameOverride?.trim()),
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
  build: RadioBuild,
  egress: RadioWireEgressIds,
  numbersBySourceChannelId: Map<string, number[]>,
  warnings: string[],
): RadioZoneDto[] {
  const limits = requireProfileExportLimits(egress);
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const maxZones = requireNumericLimit(limits.maxZones, 'maxZones', egress);
  const zoneMembersCap = requireNumericLimit(limits.zoneMembers, 'zoneMembers', egress);
  const nameLengthZone = requireNumericLimit(limits.nameLengthZone, 'nameLengthZone', egress);

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
      merged,
      egress.profileId,
      warnings,
      'Zone',
      nameLengthZone,
      Boolean(zone.wireNameOverride?.trim()),
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

/**
 * AT-D890UV wire bit 4 of 0x34 is `auto_scan` ("start scanning on channel select"),
 * not scan membership — membership lives in the scan-list member array. Mirror the
 * CSV path (channelWire.ts): carriers on, everything else off.
 */
function stampAtD890AutoScan(
  channels: RadioChannelDto[],
  scanLists: readonly RadioScanListDto[],
): RadioChannelDto[] {
  const carrierSlots = new Set(
    scanLists.map((sl) => sl.designatedTxChannel).filter((n): n is number => n != null),
  );
  return channels.map((ch) => ({ ...ch, scanAdd: carrierSlots.has(ch.slotIndex) }));
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
  const { dmrChannels, fmBroadcastChannels } = partitionAnytoneChannels(assembled, context);

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

/**
 * AM airband organisation for AT-D890UV Write.
 * Returns undefined to retain the radio AmAir/AmZone banks (empty build, or channels without zones).
 * When present, both channels and zones are always set together (product rule #756).
 */
function buildAtD890AmAirOrganisation(
  assembled: AssembledBuild,
  build: RadioBuild,
  egress: RadioWireEgressIds,
  warnings: string[],
): { amAirChannels: RadioAmAirChannelDto[]; amZones: RadioAmZoneDto[] } | undefined {
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const context = merged.channelBehaviourContext;
  const ordered = orderedAmAirChannels(assembled, context);
  const { amZones: partitionedAmZones } = partitionAnytoneZones(assembled, context);
  const zoneById = new Map(assembled.zones.map((zone) => [zone.zoneId, zone]));

  if (ordered.length === 0) {
    return undefined;
  }

  if (partitionedAmZones.length === 0) {
    warnings.push(
      `${ordered.length} AM airband channel(s) present but no AM zone membership — Web Serial leaves the radio AM airband bank unchanged (zones ship with channels). Add airband channels to a zone, or use Anytone CSV.`,
    );
    return undefined;
  }

  const nameLen = AT_D890UV_LIMITS.NAME_LENGTH;
  const reservedNames = new Set<string>();
  const amAirChannels: RadioAmAirChannelDto[] = [];
  const slotByChannelId = new Map<string, number>();

  ordered.forEach((row, index) => {
    const slot = receiveBankChannelSlot(row, index);
    if (slot < 1 || slot > AT_D890UV_LIMITS.AM_AIR_CHANNEL_MAX) {
      warnings.push(
        `AM airband channel "${row.wireName}" slot ${slot} is outside 1–${AT_D890UV_LIMITS.AM_AIR_CHANNEL_MAX}; omitted from Web Serial Write`,
      );
      return;
    }
    if (amAirChannels.length >= AT_D890UV_LIMITS.AM_AIR_CHANNEL_MAX) {
      warnings.push(
        `AM airband channel bank exceeds ${AT_D890UV_LIMITS.AM_AIR_CHANNEL_MAX}; extra channels omitted from Web Serial Write`,
      );
      return;
    }
    const wireName = applyListWireNameLimits(
      row.wireName,
      reservedNames,
      merged,
      egress.profileId,
      warnings,
      'Channel',
      nameLen,
      Boolean(row.wireNameOverride?.trim()),
    );
    amAirChannels.push({
      slotIndex: slot,
      wireName,
      rxHz: row.entity.rxFrequency ?? 0,
    });
    slotByChannelId.set(row.entity.id, slot);
  });

  if (amAirChannels.length === 0) {
    return undefined;
  }

  const reservedZoneNames = new Set<string>();
  const amZones: RadioAmZoneDto[] = [];
  for (const partitioned of partitionedAmZones) {
    if (amZones.length >= AT_D890UV_LIMITS.AM_ZONE_MAX) {
      warnings.push(
        `AM airband zone bank exceeds ${AT_D890UV_LIMITS.AM_ZONE_MAX}; extra zones omitted from Web Serial Write`,
      );
      break;
    }
    const original = zoneById.get(partitioned.zoneId);
    let channelNumbers = partitioned.memberChannelIds
      .map((id) => slotByChannelId.get(id))
      .filter((n): n is number => typeof n === 'number');
    if (channelNumbers.length === 0) continue;
    if (channelNumbers.length > AT_D890UV_LIMITS.AM_ZONE_MEMBERS_MAX) {
      warnings.push(
        `AM airband zone "${original?.wireName ?? partitioned.zoneId}" truncated from ${channelNumbers.length} to ${AT_D890UV_LIMITS.AM_ZONE_MEMBERS_MAX} members`,
      );
      channelNumbers = channelNumbers.slice(0, AT_D890UV_LIMITS.AM_ZONE_MEMBERS_MAX);
    }
    const wireName = applyListWireNameLimits(
      original?.wireName ?? partitioned.zoneId,
      reservedZoneNames,
      merged,
      egress.profileId,
      warnings,
      'Zone',
      nameLen,
      Boolean(original?.wireNameOverride?.trim()),
    );
    amZones.push({ wireName, channelNumbers, aChannelMemberIndex: 0 });
  }

  if (amZones.length === 0) {
    warnings.push(
      'AM airband channels could not be mapped into any AM zone for Web Serial Write — radio AM airband bank unchanged.',
    );
    return undefined;
  }

  return { amAirChannels, amZones };
}

export function buildRadioWriteProjection(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: LibrarySlice,
  egress: RadioWireEgressIds,
  context?: BuildRadioWriteProjectionContext,
): RadioWriteProjection {
  const warnings: string[] = [];
  const dualBank = context?.dualBank;
  const includeLibraryContacts = dualBank?.options.includeLibraryContacts ?? true;
  const dualBankMode = dualBank?.mode ?? 'codeplug';
  const directorySlice = dualBank?.directorySlice;
  const directoryRadioIds = directorySlice?.radioIds ?? [];
  const directoryDigitalContacts = directorySlice?.digitalContacts ?? [];
  let fkMaps: RadioChannelFkMaps | undefined;
  let talkGroups: RadioTalkGroupDto[] = [];
  let rxGroups: RadioRxGroupDto[] = [];
  let digitalContacts: RadioDigitalContactDto[] = [];
  let dm32RadioIds: RadioRadioIdDto[] = [];

  if (egress.profileId === 'radio-io-dm32uv' || egress.profileId === 'radio-io-at-d890uv') {
    const tgRx = buildTalkGroupsAndRx(assembled, build, egress, warnings, includeLibraryContacts);
    talkGroups = tgRx.talkGroups;
    rxGroups = tgRx.rxGroups;
    digitalContacts = tgRx.digitalContacts;
    fkMaps = tgRx.fkMaps;
    if (egress.profileId === 'radio-io-dm32uv') {
      const radioIdBank = buildDm32RadioIdBank(
        assembled,
        build,
        library,
        egress,
        warnings,
        dualBankMode,
        directoryRadioIds,
      );
      dm32RadioIds = radioIdBank.radioIds;
      fkMaps = {
        ...tgRx.fkMaps,
        dmrIdIndexByValue: radioIdBank.dmrIdIndexByValue,
      };
    }
  } else if (isOpenGd77RadioIoEgress(egress.profileId)) {
    const tgRx = buildOpenGd77ContactsAndRx(
      assembled,
      build,
      egress,
      warnings,
      includeLibraryContacts,
      directoryDigitalContacts,
    );
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
    const d890Limits = requireProfileExportLimits(egress);
    const org = buildDm32Organisation(
      projectionAssembled,
      build,
      library,
      egress,
      numbersBySourceChannelId,
      [...dtos],
      warnings,
      requireNumericLimit(d890Limits.maxScanLists, 'maxScanLists', egress),
    );
    channels = stampAtD890AutoScan(org.channels, org.scanLists);
    numbersBySourceChannelId = org.numbersBySourceChannelId;
    const amAir = buildAtD890AmAirOrganisation(assembled, build, egress, warnings);
    organisation = {
      zones: org.zones,
      scanLists: org.scanLists,
      talkGroups,
      rxGroups,
      radioIds: dm32RadioIds,
      ...(context?.singleBank?.digitalContacts !== undefined
        ? { digitalContacts: context.singleBank.digitalContacts }
        : {}),
      ...(amAir ? { amAirChannels: amAir.amAirChannels, amZones: amAir.amZones } : {}),
      aprs: radioAprsFromAnytoneLibrary(projectionAssembled, numbersBySourceChannelId, warnings),
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
      zones: buildOpenGd77Zones(assembled, build, egress, numbersBySourceChannelId, warnings),
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

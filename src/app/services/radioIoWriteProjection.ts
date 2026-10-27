/**
 * Build RadioWriteProjection from assemble + shared m×n expand for Web Serial Write.
 */

import type {
  DualBankRadioWriteOptions,
  DualBankWriteMode,
} from '@core/domain/digitalIdDirectoryProjection.ts';
import type { Channel, ChannelModeProfile } from '@core/models/library.ts';
import type { DigitalChannelMode } from '@core/models/libraryTypes.ts';
import { isValidAtD890NxdnId } from '@integrations/radio-io/radios/at-d890uv/nxdnListCodec.ts';
import { channelOwnIdOverride, defaultOwnDigitalId } from '@core/domain/ownDigitalIds.ts';
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
import {
  isAtD890RadioIoProfileId,
  isDm32RadioIoProfileId,
  isMm9pdyAtD890RadioIoProfileId,
  isMm9pdyDm32RadioIoProfileId,
} from '@core/import-export/formatProfiles.ts';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import {
  buildTalkGroupTimeslotCloneIndex,
  profileHasTalkGroupTimeslotClones,
  talkGroupSlotKey,
} from '@core/import-export/channelExpansion/talkGroupTimeslotClones.ts';
import {
  resolveWireNames,
  type WireNameEntityKind,
  type WireNameResolution,
} from '@core/services/resolveWireNames.ts';
import {
  pushWireNameResolutionWarning,
  type WireNameEntityKind as WireNameWarningEntityKind,
} from '@core/import-export/channelExpansion/wireNameWarning.ts';
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
import { channelHasUsableLocation, geoPointIsUsable } from '@core/domain/channelLocation.ts';
import {
  countChannelsWithUsableLocation,
  emptyChannelLocationWriteCounts,
  pushChannelLocationWriteSummary,
  pushStockChannelLocationNote,
  type ChannelLocationWriteCounts,
} from '@core/radio-targets/channelLocationNotes.ts';
import { AT_D890_CHANNEL_LOCATION } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { DM32_CHANNEL_LOCATION_CAPACITY } from '@integrations/radio-io/radios/dm32uv/channelLocationCodec.ts';
import type {
  RadioAmAirChannelDto,
  RadioAmZoneDto,
  RadioAprsDigitalSlotDto,
  RadioAprsDto,
  RadioDigitalContactDto,
  RadioRadioIdDto,
  RadioRxGroupDto,
  RadioNxdnListEntryDto,
  RadioNxdnListsDto,
  RadioNxdnRxGroupDto,
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
import { dropNxdnOnlyChannels } from '@core/services/anytoneChannelBanks.ts';
import { AT_D890_APRS_CURRENT_CHANNEL_WIRE } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import {
  expandAssembledChannelsToRadioDtos,
  isOpenGd77RadioIoEgress,
  openGd77NumbersBySourceChannelId,
  type RadioChannelFkMaps,
  type RadioWireEgressIds,
} from './radioIoChannelMap.ts';
import {
  pushGeneralWarning,
  pushMemberCapWarning,
  type ExportWarning,
} from '@core/import-export/exportWarning.ts';
import {
  isDmrDigitalEntity,
  keepDmrTalkGroupsAndContacts,
  keepDigitalModeTalkGroupsAndContacts,
} from '@core/import-export/dmrContactBanks.ts';

/**
 * NeonPlug quick-contact call type bytes. DM-32UV always writes group call; the AT-D890UV
 * writes group for talk groups and private for library contacts in its Contacts list.
 */
const TG_CALL_TYPE_GROUP = 0x04;
const TG_CALL_TYPE_PRIVATE = 0x03;

/** Resolve one wire-name entity kind for this build/library once, indexed by library entity id. */
function resolutionsByLibraryEntityId(
  build: RadioBuild,
  library: LibrarySlice,
  entityKind: WireNameEntityKind,
  egress: RadioWireEgressIds,
  digitalMode?: DigitalChannelMode,
): Map<string, WireNameResolution> {
  return new Map(
    resolveWireNames({
      build,
      library,
      entityKind,
      formatId: egress.formatId,
      profileId: egress.profileId,
      ...(digitalMode ? { digitalMode } : {}),
    }).map((resolution) => [resolution.libraryEntityId, resolution]),
  );
}

/**
 * Effective wire name for one row from a `resolveWireNames()` resolution map, surfacing
 * remediation as an `ExportWarning` (info/problem per remediation kind, no-op on `'none'`).
 * Falls back to `fallback` (the assembled row's own `wireName`) when the resolver skipped
 * this entity kind entirely (`'not_used'` profile limit) or the row has no match.
 */
function resolvedWireName(
  warnings: ExportWarning[],
  entityKind: WireNameWarningEntityKind,
  egress: RadioWireEgressIds,
  resolution: WireNameResolution | undefined,
  fallback: string,
): string {
  if (!resolution) return fallback;
  pushWireNameResolutionWarning(warnings, {
    entityKind,
    remediation: resolution.remediation,
    original: resolution.override ?? resolution.libraryName,
    exported: resolution.effective,
    limit: resolution.limit,
    profileId: egress.profileId,
  });
  return resolution.effective;
}

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
  warnings: ExportWarning[],
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
  warnings: ExportWarning[],
  scanListWireCap?: number,
  options?: { deriveScanLists?: boolean; emptyScanFloor?: boolean },
): {
  zones: RadioZoneDto[];
  scanLists: RadioScanListDto[];
  channels: RadioChannelDto[];
  numbersBySourceChannelId: Map<string, number[]>;
} {
  const limits = requireProfileExportLimits(egress);
  const deriveScanLists = options?.deriveScanLists !== false;
  const maxZones = requireNumericLimit(limits.maxZones, 'maxZones', egress);
  const maxScanLists = deriveScanLists
    ? (scanListWireCap ??
      Math.min(
        requireNumericLimit(limits.maxScanLists, 'maxScanLists', egress),
        DM32UV_LIMITS.CHANNEL_SCAN_LIST_ID_MAX,
      ))
    : 0;
  const scanListMembersCap = deriveScanLists
    ? requireNumericLimit(limits.scanListMembers, 'scanListMembers', egress)
    : 0;
  const maxMemorySlots = requireNumericLimit(limits.maxChannels, 'maxChannels', egress);
  const zoneMembersCap = requireNumericLimit(limits.zoneMembers, 'zoneMembers', egress);
  // Zone name length itself is no longer read here — resolveWireNames('zone') owns that limit
  // (same profileExportLimits.nameLengthZone SoT) via resolutionsByLibraryEntityId below.
  const nameLengthScanList = deriveScanLists
    ? requireNumericLimit(limits.nameLengthScanList, 'nameLengthScanList', egress)
    : 0;
  /** Slots reserved for zone scan carriers — never steal their scanListId via shared members. */
  const carrierSlots = new Set<number>();

  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const zoneResolutions = resolutionsByLibraryEntityId(build, library, 'zone', egress);
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
    const wantScan = deriveScanLists && masterOn && (entry?.exportScanList ?? false);

    if (wantScan && scanLists.length >= maxScanLists) {
      if (
        !warnings.some(
          (w) => w.kind === 'general' && w.message.includes('channel scanListId supports at most'),
        )
      ) {
        pushGeneralWarning(
          warnings,
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
          pushMemberCapWarning(warnings, {
            capKind: 'zone-scan-list-truncated',
            label: zone.wireName,
            count: scanListMembersCap,
            cap: scanListMembersCap,
            truncatedFrom: scanMembers.length,
          });
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
      pushMemberCapWarning(warnings, {
        capKind: 'zone-members-export',
        label: zone.wireName,
        count: channelNumbers.length,
        cap: zoneMembersCap,
      });
      channelNumbers = channelNumbers.slice(0, zoneMembersCap);
    }

    const wireName = resolvedWireName(
      warnings,
      'Zone',
      egress,
      zoneResolutions.get(zone.zoneId),
      zone.wireName,
    );

    zones.push({ wireName, channelNumbers });
  }

  // Empty scan floor (#564) when zone-derived lists are on.
  // AT-D890UV MM9PDY keeps deriveScanLists off. emptyScanFloor still writes one
  // list with the first channel so ScanListSet is not all zeros — the radio
  // rejects an empty occupancy bitmap. No channel means no list (an empty
  // record is skipped and the bitmap would still be cleared).
  if (scanLists.length === 0) {
    const firstCh = nextChannels.find((c) => !c.empty)?.slotIndex;
    if (deriveScanLists) {
      scanLists.push({
        wireName: DM32_EMPTY_SCAN_LIST_NAME,
        channelNumbers: firstCh != null ? [firstCh] : [],
        listIndex: 1,
      });
    } else if (options?.emptyScanFloor === true && firstCh != null) {
      scanLists.push({
        wireName: DM32_EMPTY_SCAN_LIST_NAME,
        channelNumbers: [firstCh],
        listIndex: 1,
      });
    }
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
  /**
   * AT-D890UV MM9PDY only: write NXDN channel fields and NXDN-only channels. Set by the caller
   * only when the radio reports NXDN enabled (a valid settings-store record with the NXDN-enabled byte = 1).
   * Unset or false: NXDN profiles are ignored and NXDN-only channels are left out.
   */
  atD890Nxdn?: boolean;
  dualBank?: {
    mode: DualBankWriteMode;
    options: DualBankRadioWriteOptions;
    directorySlice?: DualBankDirectorySlice;
  };
}

function buildTalkGroupsAndRx(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: LibrarySlice,
  egress: RadioWireEgressIds,
  warnings: ExportWarning[],
  includeLibraryContacts = true,
): {
  talkGroups: RadioTalkGroupDto[];
  rxGroups: RadioRxGroupDto[];
  digitalContacts: RadioDigitalContactDto[];
  fkMaps: RadioChannelFkMaps;
} {
  const limits = requireProfileExportLimits(egress);
  const isAtD890 = isAtD890RadioIoProfileId(egress.profileId);
  const maxTalkGroups = requireNumericLimit(limits.maxTalkGroups, 'maxTalkGroups', egress);
  const maxDigitalContacts =
    limits.maxContacts === 'not_used'
      ? 0
      : requireNumericLimit(limits.maxContacts, 'maxContacts', egress);
  const maxRx = requireNumericLimit(limits.maxRxGroupLists, 'maxRxGroupLists', egress);
  const maxRxMembers = requireNumericLimit(limits.rxGroupListMembers, 'rxGroupListMembers', egress);
  // The AT-D890 has a DMR bank and an NXDN bank: names are made unique within the DMR bank only.
  const bankMode = isAtD890 ? 'dmr' : undefined;
  const talkGroupResolutions = resolutionsByLibraryEntityId(
    build,
    library,
    'talkGroup',
    egress,
    bankMode,
  );
  const contactResolutions = resolutionsByLibraryEntityId(
    build,
    library,
    'contact',
    egress,
    bankMode,
  );
  const rxGroupListResolutions = resolutionsByLibraryEntityId(
    build,
    library,
    'rxGroupList',
    egress,
  );
  const contactIdByEntityId = new Map<string, number>();
  const talkGroups: RadioTalkGroupDto[] = [];
  const talkGroupTotal = assembled.talkGroups.length;

  for (const row of assembled.talkGroups) {
    if (talkGroups.length >= maxTalkGroups) break;
    // AT-D890: the codec writes no record for DMR ID 0, so give it no slot either; otherwise
    // contacts appended after it would leave a blank row in the radio's Contacts list.
    if (isAtD890 && row.entity.digitalId <= 0) continue;
    const wireName = resolvedWireName(
      warnings,
      'Talk group',
      egress,
      talkGroupResolutions.get(row.entity.id),
      row.wireName,
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
    pushGeneralWarning(
      warnings,
      `Build has ${talkGroupTotal} talk group(s); only ${maxTalkGroups} export to radio quick contacts`,
    );
  }

  const digitalContacts: RadioDigitalContactDto[] = [];
  const contactDtoByEntityId = new Map<string, RadioDigitalContactDto>();
  const digitalContactTotal = assembled.digitalContacts.length;
  // AT-D890: contacts always go to the Contacts list with the codeplug, so build the DTOs
  // regardless of the ID-database toggle.
  if (includeLibraryContacts || isAtD890) {
    for (const row of assembled.digitalContacts) {
      if (digitalContacts.length >= maxDigitalContacts) break;
      const wireName = resolvedWireName(
        warnings,
        'Contact',
        egress,
        contactResolutions.get(row.entity.id),
        row.wireName,
      );
      const dto: RadioDigitalContactDto = {
        wireName,
        digitalId: row.entity.digitalId,
        callsign: row.entity.callsign ?? '',
        city: row.entity.city ?? '',
        province: row.entity.state ?? '',
        country: row.entity.country ?? '',
        remark: row.entity.remarks ?? '',
      };
      digitalContacts.push(dto);
      contactDtoByEntityId.set(row.entity.id, dto);
    }
    if (digitalContactTotal > maxDigitalContacts) {
      pushGeneralWarning(
        warnings,
        `Build has ${digitalContactTotal} digital contact(s); only ${maxDigitalContacts} export to radio address book`,
      );
    }
  }

  if (isAtD890) {
    // Contacts list (talk-group list) is shared: talk groups first, then private contacts.
    let dropped = 0;
    for (const row of assembled.digitalContacts) {
      const dto = contactDtoByEntityId.get(row.entity.id);
      if (!dto || dto.digitalId <= 0) continue;
      if (talkGroups.length >= maxTalkGroups) {
        dropped++;
        continue;
      }
      const index = talkGroups.length + 1;
      talkGroups.push({
        index,
        wireName: dto.wireName,
        digitalId: dto.digitalId,
        callType: TG_CALL_TYPE_PRIVATE,
        callsign: dto.callsign,
        city: dto.city,
        province: dto.province,
        country: dto.country,
        remark: dto.remark,
      });
      contactIdByEntityId.set(row.entity.id, index);
    }
    if (dropped > 0) {
      pushGeneralWarning(
        warnings,
        `The radio's Contacts list holds ${maxTalkGroups} entries shared by talk groups and contacts; ${dropped} contact(s) were not written to it (talk groups go first)`,
      );
    }
  }

  const rxGroupIndexById = new Map<string, number>();
  const rxGroups: RadioRxGroupDto[] = [];
  const rxGroupTotal = assembled.rxGroupLists.length;

  for (const row of assembled.rxGroupLists) {
    if (rxGroups.length >= maxRx) break;
    const wireName = resolvedWireName(
      warnings,
      'RX group list',
      egress,
      rxGroupListResolutions.get(row.entity.id),
      row.wireName,
    );
    const memberDigitalIds: number[] = [];
    const memberTimeSlotOverrides: (1 | 2 | undefined)[] = [];
    const useTalkgroupBankSlots = isAtD890RadioIoProfileId(egress.profileId);
    const writeTimeSlots =
      isMm9pdyAtD890RadioIoProfileId(egress.profileId) ||
      isMm9pdyDm32RadioIoProfileId(egress.profileId);
    for (const member of row.entity.members) {
      if (memberDigitalIds.length >= maxRxMembers) break;
      if (member.ref.kind === 'talkGroup') {
        if (useTalkgroupBankSlots) {
          const bankIndex = contactIdByEntityId.get(member.ref.id);
          if (bankIndex != null) {
            memberDigitalIds.push(bankIndex - 1);
            if (writeTimeSlots) {
              const slot = member.timeSlotOverride;
              memberTimeSlotOverrides.push(slot === 1 || slot === 2 ? slot : undefined);
            }
          }
        } else {
          const tg = assembled.talkGroups.find((t) => t.entity.id === member.ref.id);
          if (tg) {
            memberDigitalIds.push(tg.entity.digitalId);
            if (writeTimeSlots) {
              const slot = member.timeSlotOverride;
              memberTimeSlotOverrides.push(slot === 1 || slot === 2 ? slot : undefined);
            }
          }
        }
      } else if (useTalkgroupBankSlots && member.ref.kind === 'digitalContact') {
        const bankIndex = contactIdByEntityId.get(member.ref.id);
        if (bankIndex != null) {
          memberDigitalIds.push(bankIndex - 1);
          if (writeTimeSlots) memberTimeSlotOverrides.push(undefined);
        }
      } else if (member.ref.kind === 'digitalContact') {
        const dc = assembled.digitalContacts.find((d) => d.entity.id === member.ref.id);
        if (dc) {
          memberDigitalIds.push(dc.entity.digitalId);
          if (writeTimeSlots) memberTimeSlotOverrides.push(undefined);
        }
      }
    }
    const index = rxGroups.length + 1;
    rxGroups.push({
      index,
      wireName,
      memberDigitalIds,
      ...(writeTimeSlots ? { memberTimeSlotOverrides } : {}),
    });
    // Channel byte uses 0-based in some docs; NeonPlug RX group id is 1-based in channel field bits.
    // Studio channelCodec writes rxGroupIndex & 0x3f — use 1-based index matching NeonPlug.
    rxGroupIndexById.set(row.entity.id, index);
  }
  if (rxGroupTotal > maxRx) {
    pushGeneralWarning(
      warnings,
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

/** What {@link buildAtD890NxdnLists} produces for the NXDN bank. */
interface AtD890NxdnListsResult {
  /** Unset when the build has no NXDN talk groups, contacts or RX lists (the radio's lists stay). */
  lists?: RadioNxdnListsDto;
  nxdnListIndexByEntityId: Map<string, number>;
  nxdnRxGroupIndexById: Map<string, number>;
}

/** True when `assembled` has an NXDN talk group, contact or channel (so an NXDN-enabled Write differs). */
export function assembledHasNxdnContent(assembled: AssembledBuild): boolean {
  return (
    assembledHasNxdnChannels(assembled) ||
    assembled.talkGroups.some((row) => row.entity.mode === 'nxdn') ||
    assembled.digitalContacts.some((row) => row.entity.mode === 'nxdn')
  );
}

/**
 * MM9PDY AT-D890 with NXDN enabled: the NXDN bank. Talk groups (group entries) first, then
 * contacts (individual entries), at most `NXDN_LIST_MAX`; then the RX lists that hold an NXDN
 * member or that an NXDN channel uses, with their NXDN members only (DMR members belong to the
 * DMR bank and are dropped with a warning). IDs the radio refuses are skipped with a warning.
 */
function buildAtD890NxdnLists(
  sourceAssembled: AssembledBuild,
  build: RadioBuild,
  library: LibrarySlice,
  egress: RadioWireEgressIds,
  warnings: ExportWarning[],
): AtD890NxdnListsResult {
  const nxdnListIndexByEntityId = new Map<string, number>();
  const nxdnRxGroupIndexById = new Map<string, number>();
  const assembled = keepDigitalModeTalkGroupsAndContacts(sourceAssembled, 'nxdn', warnings, {
    quiet: true,
  });
  const listMax = AT_D890UV_LIMITS.NXDN_LIST_MAX;
  const talkGroupResolutions = resolutionsByLibraryEntityId(
    build,
    library,
    'talkGroup',
    egress,
    'nxdn',
  );
  const contactResolutions = resolutionsByLibraryEntityId(
    build,
    library,
    'contact',
    egress,
    'nxdn',
  );
  const rxGroupListResolutions = resolutionsByLibraryEntityId(
    build,
    library,
    'rxGroupList',
    egress,
  );

  const entries: RadioNxdnListEntryDto[] = [];
  let badId = 0;
  let overCap = 0;
  const add = (entityId: string, entry: RadioNxdnListEntryDto) => {
    if (!isValidAtD890NxdnId(entry.nxdnId, entry.kind)) {
      badId++;
      return;
    }
    if (entries.length >= listMax) {
      overCap++;
      return;
    }
    nxdnListIndexByEntityId.set(entityId, entries.length);
    entries.push(entry);
  };
  for (const row of assembled.talkGroups) {
    add(row.entity.id, {
      wireName: resolvedWireName(
        warnings,
        'Talk group',
        egress,
        talkGroupResolutions.get(row.entity.id),
        row.wireName,
      ),
      nxdnId: row.entity.digitalId,
      kind: 'group',
    });
  }
  for (const row of assembled.digitalContacts) {
    add(row.entity.id, {
      wireName: resolvedWireName(
        warnings,
        'Contact',
        egress,
        contactResolutions.get(row.entity.id),
        row.wireName,
      ),
      nxdnId: row.entity.digitalId,
      kind: 'individual',
      callsign: row.entity.callsign,
      city: row.entity.city,
      state: row.entity.state,
      country: row.entity.country,
    });
  }
  if (badId > 0) {
    pushGeneralWarning(
      warnings,
      `${badId} NXDN talk group(s) or contact(s) have an ID the radio does not accept (1-65519, or 65535 for a talk group) and were not written`,
    );
  }
  if (overCap > 0) {
    pushGeneralWarning(
      warnings,
      `The radio's NXDN list holds ${listMax} entries shared by talk groups and contacts; ${overCap} were not written (talk groups go first)`,
    );
  }

  // RX lists an NXDN channel uses, or that have at least one NXDN member.
  const usedByNxdnChannel = new Set<string>();
  for (const row of sourceAssembled.channels) {
    for (const profile of row.entity.modeProfiles) {
      if (profile.mode === 'nxdn' && profile.rxGroupListId) {
        usedByNxdnChannel.add(profile.rxGroupListId);
      }
    }
  }
  const sourceListById = new Map(sourceAssembled.rxGroupLists.map((row) => [row.entity.id, row]));
  const rxGroups: RadioNxdnRxGroupDto[] = [];
  let droppedOtherMode = 0;
  let droppedUnlisted = 0;
  let droppedOverMembers = 0;
  let listsOverCap = 0;
  for (const row of assembled.rxGroupLists) {
    if (row.entity.members.length === 0 && !usedByNxdnChannel.has(row.entity.id)) continue;
    if (rxGroups.length >= AT_D890UV_LIMITS.NXDN_RX_GROUP_LISTS_MAX) {
      listsOverCap++;
      continue;
    }
    const memberSlots: number[] = [];
    for (const member of row.entity.members) {
      const slot = nxdnListIndexByEntityId.get(member.ref.id);
      if (slot == null) {
        droppedUnlisted++;
        continue;
      }
      if (memberSlots.length >= AT_D890UV_LIMITS.NXDN_RX_GROUP_MEMBERS_MAX) {
        droppedOverMembers++;
        continue;
      }
      memberSlots.push(slot);
    }
    droppedOtherMode +=
      (sourceListById.get(row.entity.id)?.entity.members.length ?? row.entity.members.length) -
      row.entity.members.length;
    nxdnRxGroupIndexById.set(row.entity.id, rxGroups.length);
    rxGroups.push({
      wireName: resolvedWireName(
        warnings,
        'RX group list',
        egress,
        rxGroupListResolutions.get(row.entity.id),
        row.wireName,
      ),
      memberSlots,
    });
  }
  if (droppedOtherMode > 0) {
    pushGeneralWarning(
      warnings,
      `${droppedOtherMode} RX group list member(s) are not NXDN and were left out of the radio's NXDN RX group lists`,
    );
  }
  if (droppedUnlisted > 0) {
    pushGeneralWarning(
      warnings,
      `${droppedUnlisted} NXDN RX group list member(s) are not in the radio's NXDN list and were left out`,
    );
  }
  if (droppedOverMembers > 0) {
    pushGeneralWarning(
      warnings,
      `NXDN RX group lists hold ${AT_D890UV_LIMITS.NXDN_RX_GROUP_MEMBERS_MAX} members; ${droppedOverMembers} were left out`,
    );
  }
  if (listsOverCap > 0) {
    pushGeneralWarning(
      warnings,
      `The radio holds ${AT_D890UV_LIMITS.NXDN_RX_GROUP_LISTS_MAX} NXDN RX group lists; ${listsOverCap} were not written`,
    );
  }

  // The radio's NXDN lists are left alone when the build has nothing for them.
  if (entries.length === 0 && rxGroups.length === 0) {
    return { nxdnListIndexByEntityId, nxdnRxGroupIndexById };
  }
  return { lists: { entries, rxGroups }, nxdnListIndexByEntityId, nxdnRxGroupIndexById };
}

/** NXDN channels whose call or RX list the NXDN bank could not hold: they are written without it. */
function pushAtD890NxdnUnlistedChannelWarning(
  assembled: AssembledBuild,
  fk: AtD890NxdnListsResult,
  warnings: ExportWarning[],
): void {
  let noTarget = 0;
  let noRxList = 0;
  for (const row of assembled.channels) {
    const profile = row.entity.modeProfiles.find(
      (p): p is Extract<ChannelModeProfile, { mode: 'nxdn' }> => p.mode === 'nxdn',
    );
    if (!profile) continue;
    if (profile.contactRef && !fk.nxdnListIndexByEntityId.has(profile.contactRef.id)) noTarget++;
    if (profile.rxGroupListId && !fk.nxdnRxGroupIndexById.has(profile.rxGroupListId)) noRxList++;
  }
  if (noTarget > 0) {
    pushGeneralWarning(
      warnings,
      `${noTarget} NXDN channel(s) call a talk group or contact that is not in the radio's NXDN list (not NXDN, or not written); they are written with no call target`,
    );
  }
  if (noRxList > 0) {
    pushGeneralWarning(
      warnings,
      `${noRxList} NXDN channel(s) use an RX group list that is not in the radio's NXDN RX group lists; they are written with no RX group list`,
    );
  }
}

function isDmrProfile(
  profile: ChannelModeProfile,
): profile is Extract<ChannelModeProfile, { mode: 'dmr' }> {
  return profile.mode === 'dmr';
}

/**
 * Merge library contacts and directory rows into a radio's ID lookup store
 * (DM-32 address book, AT-D890 ID database). Library rows win; overlapping directory IDs skip.
 */
function mergeLookupStoreContacts(
  libraryContacts: readonly RadioDigitalContactDto[],
  directoryContacts: readonly RadioDigitalContactDto[],
  includeLibrary: boolean,
  includeDirectory: boolean,
  serialCap: number,
  storeLabel: string,
  warnings: ExportWarning[],
): RadioDigitalContactDto[] | undefined {
  if (!includeLibrary && !includeDirectory) return undefined;
  if (includeDirectory && !includeLibrary) {
    if (directoryContacts.length > serialCap) {
      pushGeneralWarning(
        warnings,
        `Directory has more contacts than the ${storeLabel} allows; only ${serialCap} write from directory`,
      );
    }
    return directoryContacts.slice(0, serialCap);
  }
  if (includeLibrary && !includeDirectory) {
    return [...libraryContacts];
  }
  const merged = [...libraryContacts];
  const seen = new Set(
    libraryContacts.filter((row) => row.digitalId > 0).map((row) => row.digitalId),
  );
  let skippedOverlap = 0;
  let truncated = 0;
  for (const row of directoryContacts) {
    if (row.digitalId <= 0) continue;
    if (seen.has(row.digitalId)) {
      skippedOverlap++;
      continue;
    }
    if (merged.length >= serialCap) {
      truncated++;
      continue;
    }
    seen.add(row.digitalId);
    merged.push(row);
  }
  if (skippedOverlap > 0) {
    pushGeneralWarning(
      warnings,
      `Skipped ${skippedOverlap} directory row(s) whose DMR ID already exists on a library digital contact`,
    );
  }
  if (truncated > 0) {
    pushGeneralWarning(
      warnings,
      `Directory has more contacts than the ${storeLabel} allows; only ${serialCap} write from directory`,
    );
  }
  return merged;
}

/** DM-32 radio-ID names are 11 characters + NUL; AT-D890 radio-ID and master names are 16. */
const DM32_RADIO_ID_NAME_LIMIT = 11;
const AT_D890_RADIO_ID_NAME_LIMIT = 16;

/** The operator radio-ID list a Write sends, and how channels point into it. */
interface OwnRadioIdList {
  radioIds: RadioRadioIdDto[];
  dmrRadioIdIndexByOwnIdId: Map<string, number>;
  /** 0 when the library has a default DMR ID (it is entry 0), else absent. */
  dmrDefaultRadioIdIndex?: number;
}

/**
 * Operator radio-ID list for a Write: the default DMR Digital ID first (when there is one), then
 * the distinct IDs that exported channels choose, in channel order. A chosen ID is labelled with its
 * name, else with the channel that first uses it. The list is capped at `maxRadioIds`.
 */
function buildOwnRadioIdList(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: Pick<LibrarySlice, 'talkGroups' | 'digitalContacts'>,
  egress: RadioWireEgressIds,
  maxRadioIds: number,
  nameLimit: number,
  warnings: ExportWarning[],
): OwnRadioIdList {
  const ownIds = assembled.ownDigitalIds ?? [];
  const entries: { dmrId: number; name: string }[] = [];
  const indexByNumber = new Map<number, number>();
  const dmrRadioIdIndexByOwnIdId = new Map<string, number>();

  const addEntry = (number: number, name: string, unnamed?: boolean): number => {
    const known = indexByNumber.get(number);
    if (known != null) return known;
    entries.push({
      dmrId: number,
      name: name.slice(0, nameLimit),
      ...(unnamed ? { unnamed: true } : {}),
    });
    indexByNumber.set(number, entries.length - 1);
    return entries.length - 1;
  };

  const defaultId = defaultOwnDigitalId(ownIds, 'dmr');
  if (defaultId) {
    // An unnamed default is labelled by its number ("ID 2351234"), never a generic "Radio ID".
    const defaultName = defaultId.name.trim();
    dmrRadioIdIndexByOwnIdId.set(
      defaultId.id,
      addEntry(defaultId.number, defaultName || `ID ${defaultId.number}`, defaultName === ''),
    );
  }

  const considerChannelId = (profile: ChannelModeProfile, channel: Channel) => {
    const row = channelOwnIdOverride(profile, ownIds);
    if (!row || row.number <= 0) return;
    const label =
      row.name.trim() || channel.callsign?.trim() || channel.name?.trim() || `ID ${row.number}`;
    dmrRadioIdIndexByOwnIdId.set(row.id, addEntry(row.number, label));
  };

  for (const row of assembled.channels) {
    for (const profile of row.entity.modeProfiles) {
      if (isDmrProfile(profile)) considerChannelId(profile, row.entity);
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
      considerChannelId(projection.modeProfile, channel);
    }
  }

  if (entries.length > maxRadioIds) {
    pushGeneralWarning(
      warnings,
      `Build has ${entries.length} distinct DMR radio ID(s); only ${maxRadioIds} export to operator radio-ID bank`,
    );
  }
  const capped = entries.slice(0, maxRadioIds);
  for (const [id, index] of [...dmrRadioIdIndexByOwnIdId]) {
    if (index >= capped.length) dmrRadioIdIndexByOwnIdId.delete(id);
  }
  return {
    radioIds: capped.map((entry, index) => ({ index, ...entry })),
    dmrRadioIdIndexByOwnIdId,
    ...(defaultId ? { dmrDefaultRadioIdIndex: 0 } : {}),
  };
}

/**
 * Assemble → channel DTOs + source→number map + organisation (zones/scan/TG/RX for DM-32).
 */
/** Map NeonPlug APRS settings patch → radio-boundary APRS DTO. */
function radioAprsFromNeonplugPatch(
  assembled: AssembledBuild,
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>,
  warnings: ExportWarning[],
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
  warnings: ExportWarning[],
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
        pushGeneralWarning(
          warnings,
          `APRS slot references channel "${slot.channelRef.id}" outside the DMR bank; encoding Current Channel on Web Serial Write`,
        );
      } else {
        // Channel numbers are 1-based. The codec writes this value unchanged.
        reportChannelWire = wire - 1;
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
  library: LibrarySlice,
  egress: RadioWireEgressIds,
  warnings: ExportWarning[],
  includeLibraryContacts = true,
): {
  talkGroups: RadioTalkGroupDto[];
  rxGroups: RadioRxGroupDto[];
  digitalContacts: RadioDigitalContactDto[];
  fkMaps: RadioChannelFkMaps;
} {
  const limits = requireProfileExportLimits(egress);
  const nameLen = requireNumericLimit(limits.nameLengthTalkGroup, 'nameLengthTalkGroup', egress);
  const maxRx = requireNumericLimit(limits.maxRxGroupLists, 'maxRxGroupLists', egress);
  const maxRxMembers = requireNumericLimit(limits.rxGroupListMembers, 'rxGroupListMembers', egress);
  const maxContacts = requireNumericLimit(limits.maxContacts, 'maxContacts', egress);
  const talkGroupResolutions = resolutionsByLibraryEntityId(build, library, 'talkGroup', egress);
  const contactResolutions = resolutionsByLibraryEntityId(build, library, 'contact', egress);
  const rxGroupListResolutions = resolutionsByLibraryEntityId(
    build,
    library,
    'rxGroupList',
    egress,
  );

  const contactIdByEntityId = new Map<string, number>();
  const contactIndexByTalkGroupSlot = new Map<string, number>();
  const talkGroups: RadioTalkGroupDto[] = [];
  // Seeded from the resolved base names so clone-name generation below (which needs its own
  // anti-collision pool) doesn't collide with them — mirrors the old applyTalkGroupWireNameLimits
  // reserve-as-you-go behaviour without re-doing the resolver's own uniquify.
  const reservedTg = new Set<string>();

  const baseWireNames = new Map<string, string>();
  for (const row of assembled.talkGroups) {
    const wireName = resolvedWireName(
      warnings,
      'Talk group',
      egress,
      talkGroupResolutions.get(row.entity.id),
      row.wireName,
    );
    baseWireNames.set(row.entity.id, wireName);
    reservedTg.add(wireName);
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
  let nextContactIndex = talkGroups.length + 1;
  if (includeLibraryContacts) {
    for (const row of assembled.digitalContacts) {
      if (nextContactIndex > maxContacts) break;
      const wireName = resolvedWireName(
        warnings,
        'Contact',
        egress,
        contactResolutions.get(row.entity.id),
        row.wireName,
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

  const rxGroupIndexById = new Map<string, number>();
  const rxGroups: RadioRxGroupDto[] = [];

  for (const row of assembled.rxGroupLists) {
    if (rxGroups.length >= maxRx) break;
    const wireName = resolvedWireName(
      warnings,
      'RX group list',
      egress,
      rxGroupListResolutions.get(row.entity.id),
      row.wireName,
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
  library: LibrarySlice,
  egress: RadioWireEgressIds,
  numbersBySourceChannelId: Map<string, number[]>,
  warnings: ExportWarning[],
): RadioZoneDto[] {
  const limits = requireProfileExportLimits(egress);
  const maxZones = requireNumericLimit(limits.maxZones, 'maxZones', egress);
  const zoneMembersCap = requireNumericLimit(limits.zoneMembers, 'zoneMembers', egress);
  const zoneResolutions = resolutionsByLibraryEntityId(build, library, 'zone', egress);

  const zones: RadioZoneDto[] = [];

  for (const zone of assembled.zones) {
    if (zones.length >= maxZones) break;
    let channelNumbers: number[] = [];
    for (const channelId of zone.memberChannelIds) {
      const nums = numbersBySourceChannelId.get(channelId);
      if (nums) channelNumbers.push(...nums);
    }
    if (channelNumbers.length > zoneMembersCap) {
      pushMemberCapWarning(warnings, {
        capKind: 'zone-members-export',
        label: zone.wireName,
        count: channelNumbers.length,
        cap: zoneMembersCap,
      });
      channelNumbers = channelNumbers.slice(0, zoneMembersCap);
    }
    const wireName = resolvedWireName(
      warnings,
      'Zone',
      egress,
      zoneResolutions.get(zone.zoneId),
      zone.wireName,
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
  sourceAssembled: AssembledBuild,
  build: RadioBuild,
  egress: RadioWireEgressIds,
  warnings: ExportWarning[],
  nxdnOn: boolean,
): AssembledBuild {
  // NXDN-only channels are eligible on MM9PDY; without NXDN output they have nowhere to go.
  const assembled = nxdnOn ? sourceAssembled : dropNxdnOnlyChannels(sourceAssembled);
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const context = merged.channelBehaviourContext;
  const { dmrChannels, fmBroadcastChannels } = partitionAnytoneChannels(assembled, context);

  if (fmBroadcastChannels.length > 0) {
    pushGeneralWarning(
      warnings,
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
  warnings: ExportWarning[],
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
    pushGeneralWarning(
      warnings,
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
      pushGeneralWarning(
        warnings,
        `AM airband channel "${row.wireName}" slot ${slot} is outside 1–${AT_D890UV_LIMITS.AM_AIR_CHANNEL_MAX}; omitted from Web Serial Write`,
      );
      return;
    }
    if (amAirChannels.length >= AT_D890UV_LIMITS.AM_AIR_CHANNEL_MAX) {
      pushGeneralWarning(
        warnings,
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
      pushGeneralWarning(
        warnings,
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
      pushMemberCapWarning(warnings, {
        capKind: 'zone-members-export',
        label: original?.wireName ?? partitioned.zoneId,
        count: channelNumbers.length,
        cap: AT_D890UV_LIMITS.AM_ZONE_MEMBERS_MAX,
      });
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
    pushGeneralWarning(
      warnings,
      'AM airband channels could not be mapped into any AM zone for Web Serial Write — radio AM airband bank unchanged.',
    );
    return undefined;
  }

  return { amAirChannels, amZones };
}

/**
 * MM9PDY channel location table: stamp `location` / `useLocation` on each slot DTO from its
 * source library channel, after reorder (slot ↔ source via `numbersBySourceChannelId`).
 * Only slots that get a table entry carry a position; every other DTO has both cleared.
 */
function stampMm9pdyChannelLocations(
  channels: readonly RadioChannelDto[],
  assembled: AssembledBuild,
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>,
  capacity: number,
): { channels: RadioChannelDto[]; counts: ChannelLocationWriteCounts } {
  const entityBySlot = new Map<number, Channel>();
  const entityById = new Map(assembled.channels.map((row) => [row.entity.id, row.entity]));
  for (const [sourceId, numbers] of numbersBySourceChannelId) {
    const entity = entityById.get(sourceId);
    if (!entity) continue;
    for (const n of numbers) entityBySlot.set(n, entity);
  }
  const counts = emptyChannelLocationWriteCounts();
  const stamped = channels.map((ch) => {
    const { location: _location, useLocation: _useLocation, ...rest } = ch;
    void _location;
    void _useLocation;
    if (ch.empty) return rest;
    const entity = entityBySlot.get(ch.slotIndex);
    if (!entity || !geoPointIsUsable(entity.location)) {
      counts.noPosition += 1;
      return rest;
    }
    if (!channelHasUsableLocation(entity)) {
      counts.useLocationOff += 1;
      return rest;
    }
    if (ch.slotIndex > capacity) {
      counts.overCapacity += 1;
      return rest;
    }
    counts.written += 1;
    return {
      ...rest,
      location: { lat: entity.location!.lat, lon: entity.location!.lon },
      useLocation: true,
    };
  });
  return { channels: stamped, counts };
}

/** Strip any position from stock D890 / DM32 DTOs (the stock codec never writes one). */
function withoutChannelLocations(channels: readonly RadioChannelDto[]): RadioChannelDto[] {
  return channels.map((ch) => {
    if (ch.location === undefined && ch.useLocation === undefined) return ch;
    const { location: _location, useLocation: _useLocation, ...rest } = ch;
    void _location;
    void _useLocation;
    return rest;
  });
}

/** AT-D890: channels whose TX contact is a library contact that missed the Contacts list. */
function pushAtD890UnlistedContactChannelWarning(
  assembled: AssembledBuild,
  contactIdByEntityId: ReadonlyMap<string, number> | undefined,
  nonDmrContactIds: ReadonlySet<string>,
  warnings: ExportWarning[],
): void {
  let n = 0;
  for (const row of assembled.channels) {
    const dmr = row.entity.modeProfiles.find(isDmrProfile);
    const ref = dmr?.contactRef;
    if (ref?.kind !== 'digitalContact') continue;
    if (contactIdByEntityId?.has(ref.id)) continue;
    // Non-DMR contacts have their own warning (keepDmrTalkGroupsAndContacts).
    if (nonDmrContactIds.has(ref.id)) continue;
    n++;
  }
  if (n > 0) {
    pushGeneralWarning(
      warnings,
      `${n} channel(s) call a contact that is not in the radio's Contacts list; they are written with no TX contact`,
    );
  }
}

/** True when any assembled channel has a DMR profile (so a missing default DMR ID matters). */
function assembledHasDmrChannels(assembled: AssembledBuild): boolean {
  return assembled.channels.some((row) => row.entity.modeProfiles.some(isDmrProfile));
}

/** True when any assembled channel has an NXDN profile (so an NXDN-enabled Write would differ). */
export function assembledHasNxdnChannels(assembled: AssembledBuild): boolean {
  return assembled.channels.some((row) =>
    row.entity.modeProfiles.some((profile) => profile.mode === 'nxdn'),
  );
}

export function buildRadioWriteProjection(
  sourceAssembled: AssembledBuild,
  build: RadioBuild,
  library: LibrarySlice,
  egress: RadioWireEgressIds,
  context?: BuildRadioWriteProjectionContext,
): RadioWriteProjection {
  const warnings: ExportWarning[] = [];
  const nxdnOn = isMm9pdyAtD890RadioIoProfileId(egress.profileId) && context?.atD890Nxdn === true;
  // AT-D890: the talk-group, Contacts and ID-database banks are DMR-only; NXDN etc. stay out.
  const assembled = isAtD890RadioIoProfileId(egress.profileId)
    ? keepDmrTalkGroupsAndContacts(sourceAssembled, warnings)
    : sourceAssembled;
  const dualBank = context?.dualBank;
  const includeLibraryContacts = dualBank?.options.includeLibraryContacts ?? true;
  const includeDigitalIdDirectory = dualBank?.options.includeDigitalIdDirectory ?? false;
  const dualBankMode = dualBank?.mode ?? 'codeplug';
  const directorySlice = dualBank?.directorySlice;
  let fkMaps: RadioChannelFkMaps | undefined;
  let talkGroups: RadioTalkGroupDto[] = [];
  let rxGroups: RadioRxGroupDto[] = [];
  let digitalContacts: RadioDigitalContactDto[] = [];
  let dm32RadioIds: RadioRadioIdDto[] = [];
  let atD890RadioIds: RadioRadioIdDto[] = [];
  let dm32AddressBook: RadioDigitalContactDto[] | undefined;
  let atD890Db: RadioDigitalContactDto[] | undefined;
  let nxdnLists: AtD890NxdnListsResult | undefined;

  if (isDm32RadioIoProfileId(egress.profileId) || isAtD890RadioIoProfileId(egress.profileId)) {
    const tgRx = buildTalkGroupsAndRx(
      assembled,
      build,
      library,
      egress,
      warnings,
      includeLibraryContacts,
    );
    talkGroups = tgRx.talkGroups;
    rxGroups = tgRx.rxGroups;
    digitalContacts = tgRx.digitalContacts;
    fkMaps = tgRx.fkMaps;
    if (isDm32RadioIoProfileId(egress.profileId)) {
      const radioIdBank = buildOwnRadioIdList(
        assembled,
        build,
        library,
        egress,
        requireNumericLimit(requireProfileExportLimits(egress).maxRadioIds, 'maxRadioIds', egress),
        DM32_RADIO_ID_NAME_LIMIT,
        warnings,
      );
      dm32RadioIds = radioIdBank.radioIds;
      fkMaps = {
        ...tgRx.fkMaps,
        dmrRadioIdIndexByOwnIdId: radioIdBank.dmrRadioIdIndexByOwnIdId,
        ...(radioIdBank.dmrDefaultRadioIdIndex != null
          ? { dmrDefaultRadioIdIndex: radioIdBank.dmrDefaultRadioIdIndex }
          : {}),
      };
      dm32AddressBook = mergeLookupStoreContacts(
        tgRx.digitalContacts,
        directorySlice?.digitalContacts ?? [],
        includeLibraryContacts,
        includeDigitalIdDirectory,
        DM32UV_LIMITS.ADDRESS_BOOK_WRITE_MAX,
        'DM-32 address book',
        warnings,
      );
    } else if (isAtD890RadioIoProfileId(egress.profileId) && dualBankMode === 'codeplug') {
      const defaultId = defaultOwnDigitalId(assembled.ownDigitalIds ?? [], 'dmr');
      if (defaultId) {
        // Master ID = radioIds[0] = the default; Default channels point at slot 0, an override at its slot.
        const radioIdBank = buildOwnRadioIdList(
          assembled,
          build,
          library,
          egress,
          AT_D890UV_LIMITS.RADIO_IDS_MAX,
          AT_D890_RADIO_ID_NAME_LIMIT,
          warnings,
        );
        atD890RadioIds = radioIdBank.radioIds;
        fkMaps = {
          ...tgRx.fkMaps,
          dmrRadioIdIndexByOwnIdId: radioIdBank.dmrRadioIdIndexByOwnIdId,
          ...(radioIdBank.dmrDefaultRadioIdIndex != null
            ? { dmrDefaultRadioIdIndex: radioIdBank.dmrDefaultRadioIdIndex }
            : {}),
        };
      } else if (assembledHasDmrChannels(assembled)) {
        pushGeneralWarning(
          warnings,
          'Radio IDs not written: set a default DMR ID in Digital IDs. The radio keeps the radio IDs and master ID it has.',
        );
      }
    }
    if (isAtD890RadioIoProfileId(egress.profileId) && nxdnOn) {
      nxdnLists = buildAtD890NxdnLists(sourceAssembled, build, library, egress, warnings);
      fkMaps = {
        ...fkMaps,
        nxdnListIndexByEntityId: nxdnLists.nxdnListIndexByEntityId,
        nxdnRxGroupIndexById: nxdnLists.nxdnRxGroupIndexById,
      };
    }
    if (isAtD890RadioIoProfileId(egress.profileId) && dualBank) {
      // AT-D890 ID database: written only when the Contacts part supplies a dual-bank context.
      atD890Db = mergeLookupStoreContacts(
        tgRx.digitalContacts,
        directorySlice?.digitalContacts ?? [],
        includeLibraryContacts,
        includeDigitalIdDirectory,
        requireNumericLimit(requireProfileExportLimits(egress).maxContacts, 'maxContacts', egress),
        'AT-D890 ID database',
        warnings,
      );
    }
  } else if (isOpenGd77RadioIoEgress(egress.profileId)) {
    const tgRx = buildOpenGd77ContactsAndRx(
      assembled,
      build,
      library,
      egress,
      warnings,
      includeLibraryContacts,
    );
    talkGroups = tgRx.talkGroups;
    rxGroups = tgRx.rxGroups;
    digitalContacts = tgRx.digitalContacts;
    fkMaps = { ...tgRx.fkMaps, ownDigitalIds: assembled.ownDigitalIds ?? [] };
  }

  const projectionAssembled = isAtD890RadioIoProfileId(egress.profileId)
    ? buildAtD890DmrBankAssembled(assembled, build, egress, warnings, nxdnOn)
    : assembled;

  const { dtos, warnings: channelWarnings } = expandAssembledChannelsToRadioDtos(
    projectionAssembled,
    build,
    library,
    egress,
    fkMaps,
    nxdnOn ? { nxdn: true } : undefined,
  );
  warnings.push(...channelWarnings);

  if (nxdnLists) pushAtD890NxdnUnlistedChannelWarning(projectionAssembled, nxdnLists, warnings);
  if (isAtD890RadioIoProfileId(egress.profileId)) {
    pushAtD890UnlistedContactChannelWarning(
      projectionAssembled,
      fkMaps?.contactIdByEntityId,
      new Set(
        sourceAssembled.digitalContacts
          .filter((row) => !isDmrDigitalEntity(row.entity))
          .map((row) => row.entity.id),
      ),
      warnings,
    );
  }

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

  if (isDm32RadioIoProfileId(egress.profileId)) {
    const mm9pdy = isMm9pdyDm32RadioIoProfileId(egress.profileId);
    const org = buildDm32Organisation(
      assembled,
      build,
      library,
      egress,
      numbersBySourceChannelId,
      [...dtos],
      warnings,
      undefined,
      mm9pdy ? { deriveScanLists: false } : undefined,
    );
    channels = mm9pdy
      ? org.channels.map((ch) => (ch.empty ? ch : { ...ch, scanListId: 0 }))
      : org.channels;
    // With a default DMR ID no channel is left on "no ID" (0xFF): the radio refuses to transmit
    // on one (#1445). Analogue channels point at the default too, which the radio ignores.
    const defaultRadioIdIndex = fkMaps?.dmrDefaultRadioIdIndex;
    if (defaultRadioIdIndex != null) {
      channels = channels.map((ch) =>
        ch.empty || ch.dmrRadioIdIndex != null
          ? ch
          : { ...ch, dmrRadioIdIndex: defaultRadioIdIndex },
      );
    }
    numbersBySourceChannelId = org.numbersBySourceChannelId;
    organisation = {
      zones: org.zones,
      scanLists: mm9pdy ? [] : org.scanLists,
      talkGroups,
      rxGroups,
      ...(mm9pdy ? { writeRxGroupTimeSlotOverrides: true } : {}),
      ...(mm9pdy && build.exportSettings?.assignMm9pdyStepKeys === true
        ? { assignMm9pdyStepKeys: true }
        : {}),
      ...(dm32AddressBook !== undefined ? { digitalContacts: dm32AddressBook } : {}),
      ...(dualBankMode === 'codeplug' ? { radioIds: dm32RadioIds } : {}),
      aprs: radioAprsFromNeonplugPatch(assembled, numbersBySourceChannelId, warnings),
    };
  } else if (isAtD890RadioIoProfileId(egress.profileId)) {
    const mm9pdy = isMm9pdyAtD890RadioIoProfileId(egress.profileId);
    const d890Limits = requireProfileExportLimits(egress);
    const org = buildDm32Organisation(
      projectionAssembled,
      build,
      library,
      egress,
      numbersBySourceChannelId,
      [...dtos],
      warnings,
      mm9pdy ? undefined : requireNumericLimit(d890Limits.maxScanLists, 'maxScanLists', egress),
      { deriveScanLists: !mm9pdy, emptyScanFloor: mm9pdy },
    );
    channels = stampAtD890AutoScan(org.channels, org.scanLists);
    if (mm9pdy) {
      // The MM9PDY firmware treats a channel as NXDN-capable in NXDN mode if any of 0x66-0x6E is
      // non-zero, so a channel without NXDN fields gets zeros there, not the previous occupant's.
      channels = channels.map((ch) => (ch.empty || ch.nxdn ? ch : { ...ch, clearNxdnBytes: true }));
    }
    numbersBySourceChannelId = org.numbersBySourceChannelId;
    const amAir = buildAtD890AmAirOrganisation(assembled, build, egress, warnings);
    organisation = {
      zones: org.zones,
      scanLists: org.scanLists,
      talkGroups,
      rxGroups,
      ...(mm9pdy ? { writeRxGroupTimeSlotOverrides: true } : {}),
      atD890SettingsTarget: mm9pdy ? 'mm9pdy' : 'stock',
      ...(nxdnLists?.lists ? { nxdnLists: nxdnLists.lists } : {}),
      radioIds: atD890RadioIds,
      ...(atD890Db !== undefined ? { digitalContacts: atD890Db } : {}),
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
      zones: buildOpenGd77Zones(
        assembled,
        build,
        library,
        egress,
        numbersBySourceChannelId,
        warnings,
      ),
      ...(includeLibraryContacts ? { talkGroups, rxGroups, digitalContacts } : {}),
      ...(dualBank?.options.includeDigitalIdDirectory
        ? { userDatabaseContacts: directorySlice?.digitalContacts ?? [] }
        : {}),
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

  let channelLocations: RadioWriteProjection['channelLocations'];
  if (isDm32RadioIoProfileId(egress.profileId) || isAtD890RadioIoProfileId(egress.profileId)) {
    const mm9pdy =
      isMm9pdyDm32RadioIoProfileId(egress.profileId) ||
      isMm9pdyAtD890RadioIoProfileId(egress.profileId);
    const locatedChannels = countChannelsWithUsableLocation(
      projectionAssembled.channels.map((row) => row.entity),
    );
    if (mm9pdy) {
      const capacity = isAtD890RadioIoProfileId(egress.profileId)
        ? AT_D890_CHANNEL_LOCATION.MAX_ENTRIES
        : DM32_CHANNEL_LOCATION_CAPACITY;
      const stamped = stampMm9pdyChannelLocations(
        channels,
        projectionAssembled,
        numbersBySourceChannelId,
        capacity,
      );
      channels = stamped.channels;
      organisation = {
        ...organisation,
        writeChannelLocationTable: true,
        channelDistanceUnit: build.exportSettings?.channelDistanceUnit ?? 'km',
      };
      pushChannelLocationWriteSummary(warnings, stamped.counts);
      channelLocations = { counts: stamped.counts, locatedChannels };
    } else {
      channels = withoutChannelLocations(channels);
      pushStockChannelLocationNote(
        warnings,
        build.radioTargetId,
        projectionAssembled.channels.map((row) => row.entity),
      );
      channelLocations = { locatedChannels };
    }
  }

  return {
    channels,
    organisation,
    numbersBySourceChannelId,
    warnings,
    ...(channelLocations ? { channelLocations } : {}),
  };
}

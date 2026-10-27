/**
 * Map assemble() projection channels → radio-boundary DTOs for Web Serial encode.
 * Applies RadioBuild export name settings (profile nameLimit, shortenNames, …).
 * When the radio target has MxNChannelExpansion, fans out via expandAllMxNChannels
 * (same projection as CPS export / wire preview).
 * No framing — integrations radio modules consume RadioChannelDto only.
 */

import type { AssembledBuild, AssembledChannel, LibrarySlice } from '@core/services/assemble.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { Channel, ChannelModeProfile, OwnDigitalId } from '@core/models/library.ts';
import { channelOwnIdOverride } from '@core/domain/ownDigitalIds.ts';
import { expandAllMxNChannels } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import type { ExpandedMxNChannelRow } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { mxnSiteWireNameResolverForRadioTarget } from '@core/services/anytoneChannelExpansion.ts';
import { filterExpandedRowsByOverrides } from '@core/domain/formatBuildOverrides.ts';
import {
  resolveExportMemorySlotAssignments,
  type ExportMemorySlot,
} from '@core/domain/exportOrderOrSlot.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { effectiveForbidTransmit } from '@core/import-export/channelBehaviourDefaults/index.ts';
import { getProfileExportLimits } from '@core/import-export/profileExportLimits.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
import type {
  RadioChannelDto,
  RadioChannelMode,
  RadioChannelNxdnDto,
} from '@integrations/radio-io/radioChannelDto.ts';
import { channelToneToRadioTone } from '@app/lib/channelFields/channelToneToRadioTone.ts';
import { expandOpenGd77ChannelWireRows } from '@core/import-export/opengd77ExportModes.ts';
import type { ExpandedChannelWireRow } from '@core/import-export/channelExpansion/multiMode.ts';
import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import { resolveWireNames } from '@core/services/resolveWireNames.ts';
import { pushWireNameResolutionWarning } from '@core/import-export/channelExpansion/wireNameWarning.ts';
import { resolveDmrOperatingMode } from '@core/domain/dmrOperatingMode.ts';

export interface RadioWireEgressIds {
  formatId: string;
  profileId: string;
}

/** Options for the AT-D890UV MM9PDY channel projection. */
export interface RadioChannelProjectionOptions {
  /**
   * Project NXDN profiles (`dto.nxdn`, NXDN-only channels). Set only for the MM9PDY AT-D890UV
   * target when the radio reports NXDN enabled; otherwise NXDN profiles are ignored.
   */
  nxdn?: boolean;
}

export interface AssembledChannelsToRadioDtosResult {
  dtos: RadioChannelDto[];
  warnings: ExportWarning[];
}

/** Optional radio-native FK maps for TX-contact / RX-group indices. */
export interface RadioChannelFkMaps {
  contactIdByEntityId?: ReadonlyMap<string, number>;
  /** OpenGD77 TS clones: `${talkGroupId}:${slot}` → 1-based contact bank index. */
  contactIndexByTalkGroupSlot?: ReadonlyMap<string, number>;
  rxGroupIndexById?: ReadonlyMap<string, number>;
  /** Digital ID row id → 0-based operator radio-ID list index (AT-D890, DM-32UV). */
  dmrRadioIdIndexByOwnIdId?: ReadonlyMap<string, number>;
  /**
   * List index a DMR channel on Default points at. Set only when the library has a default DMR ID
   * and the target writes a radio-ID list; absent leaves the byte as before.
   */
  dmrDefaultRadioIdIndex?: number;
  /** OpenGD77 Web Serial: the library's Digital IDs, so a channel's choice resolves to its number. */
  ownDigitalIds?: readonly OwnDigitalId[];
}

/** Radio-ID list index for a DMR profile: its chosen Digital ID, else the default's slot. */
function resolveDmrRadioIdIndex(
  dmr: Extract<ChannelModeProfile, { mode: 'dmr' }>,
  maps?: RadioChannelFkMaps,
): number | undefined {
  if (!maps) return undefined;
  if (dmr.ownDigitalIdId) {
    const chosen = maps.dmrRadioIdIndexByOwnIdId?.get(dmr.ownDigitalIdId);
    if (chosen != null) return chosen;
  }
  return maps.dmrDefaultRadioIdIndex;
}

function resolveContactId(
  ref: { kind: string; id: string } | null | undefined,
  maps?: RadioChannelFkMaps,
  channelTimeslot?: 1 | 2,
): number | undefined {
  if (!ref || !maps) return undefined;
  if (ref.kind === 'talkGroup' && maps.contactIndexByTalkGroupSlot) {
    const slot = channelTimeslot === 2 ? 2 : 1;
    const keyed = maps.contactIndexByTalkGroupSlot.get(`${ref.id}:${slot}`);
    if (keyed != null && keyed > 0) return keyed;
  }
  if (!maps.contactIdByEntityId) return undefined;
  const id = maps.contactIdByEntityId.get(ref.id);
  return id != null && id > 0 ? id : undefined;
}

function resolveRxGroupIndex(
  rxGroupListId: string | null | undefined,
  maps?: RadioChannelFkMaps,
): number | undefined {
  if (!rxGroupListId || !maps?.rxGroupIndexById) return undefined;
  const idx = maps.rxGroupIndexById.get(rxGroupListId);
  return idx != null ? idx : undefined;
}

function bandwidthFromKHz(bandwidthKHz: number | null | undefined): 'FM' | 'NFM' {
  if (bandwidthKHz == null) return 'NFM';
  return bandwidthKHz <= 15 ? 'NFM' : 'FM';
}

/** CHIRP UV-17Pro family: AM has no wire bit — encode as FM wide (not NFM). */
function bandwidthFromAnalogProfile(
  analog: Pick<ChannelModeProfile, 'mode'> & { bandwidthKHz?: number | null },
): 'FM' | 'NFM' {
  if (analog.mode === 'am') return 'FM';
  return bandwidthFromKHz(analog.bandwidthKHz);
}

function channelSlotIndexMap(
  channels: readonly AssembledChannel[],
  channelMemorySlots?: readonly ExportMemorySlot[],
): Map<string, number> {
  if (channelMemorySlots && channelMemorySlots.length > 0) {
    const map = new Map<string, number>();
    for (const slot of channelMemorySlots) {
      if (slot.channelId != null) {
        map.set(slot.channelId, slot.slot);
      }
    }
    return map;
  }
  return resolveExportMemorySlotAssignments(
    channels.map((row) => ({
      channelId: row.entity.id,
      orderOrSlot: row.orderOrSlot,
    })),
  );
}

function isOpenGd77RadioIoEgress(profileId: string): boolean {
  return profileId === 'radio-io-opengd77-1701' || profileId === 'radio-io-opengd77-md9600';
}

export { isOpenGd77RadioIoEgress };

function isDmrProfile(
  profile: ChannelModeProfile,
): profile is Extract<ChannelModeProfile, { mode: 'dmr' }> {
  return profile.mode === 'dmr';
}

function aprsFieldsFromChannel(channel: Channel): Partial<RadioChannelDto> {
  const aprs = channel.aprs;
  if (!aprs) return {};
  return {
    aprsReceive: aprs.receiveEnabled === true,
    aprsReportMode: aprs.reportType === 'digital' ? 'digital' : 'off',
    aprsDigitalPttMode: aprs.digitalPttMode === 'on' ? 'on' : 'off',
    ...(aprs.reportSlotIndex != null ? { aprsReportSlotIndex: aprs.reportSlotIndex } : {}),
  };
}

function isNxdnProfile(
  profile: ChannelModeProfile,
): profile is Extract<ChannelModeProfile, { mode: 'nxdn' }> {
  return profile.mode === 'nxdn';
}

const NXDN_RAN_MAX = 63;

/** `dto.nxdn` from a library NXDN profile. A RAN outside 0-63 is left out and counted. */
function nxdnFieldsFromProfile(
  profile: Extract<ChannelModeProfile, { mode: 'nxdn' }>,
  invalidRan: { count: number },
): RadioChannelNxdnDto {
  const nxdn: RadioChannelNxdnDto = {};
  const ran = (value: number | null | undefined): number | undefined => {
    if (value == null) return undefined;
    if (Number.isInteger(value) && value >= 0 && value <= NXDN_RAN_MAX) return value;
    invalidRan.count++;
    return undefined;
  };
  const rxRan = ran(profile.rxRan);
  const txRan = ran(profile.txRan);
  if (rxRan != null) nxdn.rxRan = rxRan;
  if (txRan != null) nxdn.txRan = txRan;
  if (profile.nxdnRate != null) nxdn.rate = profile.nxdnRate;
  return nxdn;
}

function digitalFieldsFromChannel(
  channel: Channel,
  fkMaps?: RadioChannelFkMaps,
  nxdnOptions?: { invalidRan: { count: number } },
): Partial<RadioChannelDto> {
  const dmr = channel.modeProfiles.find((p) => p.mode === 'dmr');
  const analog = channel.modeProfiles.find((p) => p.mode === 'fm' || p.mode === 'am');
  const nxdnProfile = nxdnOptions ? channel.modeProfiles.find(isNxdnProfile) : undefined;
  const nxdnFields: Partial<RadioChannelDto> =
    nxdnProfile && nxdnOptions
      ? { nxdn: nxdnFieldsFromProfile(nxdnProfile, nxdnOptions.invalidRan) }
      : {};
  // The mode byte follows the DMR rule; an NXDN profile counts as the digital half when there is
  // no DMR profile (NXDN mode forces A+D / D+A to D-Digital on the radio anyway).
  const digital = dmr ?? nxdnProfile;
  let mode: RadioChannelMode | undefined;
  if (digital && analog) mode = 'fixed-digital';
  else if (digital) mode = 'digital';
  else if (analog) mode = 'analog';

  if (!dmr) {
    return { ...(mode ? { mode } : {}), ...nxdnFields, ...aprsFieldsFromChannel(channel) };
  }

  const timeslot = dmr.timeslot === 2 ? 2 : dmr.timeslot === 1 ? 1 : undefined;
  const txContactId = resolveContactId(dmr.contactRef, fkMaps, timeslot);
  const rxGroupIndex = resolveRxGroupIndex(dmr.rxGroupListId, fkMaps);
  const dmrRadioIdIndex = resolveDmrRadioIdIndex(dmr, fkMaps);
  return {
    mode: mode ?? 'digital',
    colorCode: dmr.colourCode ?? undefined,
    timeslot,
    dmrOperatingMode: resolveDmrOperatingMode(channel),
    ...(txContactId != null ? { txContactId } : {}),
    ...(rxGroupIndex != null ? { rxGroupIndex } : {}),
    ...(dmrRadioIdIndex != null ? { dmrRadioIdIndex } : {}),
    ...nxdnFields,
    ...aprsFieldsFromChannel(channel),
  };
}

/** The DMR number a channel explicitly chose (never the default), for targets that write it per channel. */
function resolveDmrOwnIdNumber(
  dmr: Extract<ChannelModeProfile, { mode: 'dmr' }>,
  maps?: RadioChannelFkMaps,
): number | undefined {
  if (!maps?.ownDigitalIds) return undefined;
  return channelOwnIdOverride(dmr, maps.ownDigitalIds)?.number;
}

function digitalFieldsFromExpandedWireRow(
  expansion: ExpandedChannelWireRow,
  channel: Channel,
  fkMaps?: RadioChannelFkMaps,
): Partial<RadioChannelDto> {
  const dmr = isDmrProfile(expansion.modeProfile) ? expansion.modeProfile : null;

  if (!dmr) {
    return { mode: 'analog', ...aprsFieldsFromChannel(channel) };
  }

  const timeslot = dmr.timeslot === 2 ? 2 : dmr.timeslot === 1 ? 1 : undefined;
  const txContactId = resolveContactId(dmr.contactRef, fkMaps, timeslot);
  const rxGroupIndex = resolveRxGroupIndex(dmr.rxGroupListId, fkMaps);
  const dmrRadioIdIndex = resolveDmrRadioIdIndex(dmr, fkMaps);
  const ownDmrId = resolveDmrOwnIdNumber(dmr, fkMaps);
  return {
    mode: 'digital',
    colorCode: dmr.colourCode ?? undefined,
    timeslot,
    dmrOperatingMode: resolveDmrOperatingMode(channel),
    ...(txContactId != null ? { txContactId } : {}),
    ...(rxGroupIndex != null ? { rxGroupIndex } : {}),
    ...(dmrRadioIdIndex != null ? { dmrRadioIdIndex } : {}),
    ...(ownDmrId != null ? { dmrId: ownDmrId } : {}),
    ...aprsFieldsFromChannel(channel),
  };
}

function expandOpenGd77AssembledWireRows(
  channels: readonly AssembledChannel[],
  build: RadioBuild,
  egress: RadioWireEgressIds,
  warnings: ExportWarning[],
): ExpandedChannelWireRow[] {
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const reserved = new Set<string>();
  const expandModes = merged.expandModes ?? true;
  return filterExpandedRowsByOverrides(
    channels.flatMap((row) =>
      expandOpenGd77ChannelWireRows(
        row.entity,
        row.wireNameOverride?.trim() || row.wireName,
        expandModes,
        merged,
        merged.profileId ?? egress.profileId,
        reserved,
        warnings,
      ),
    ),
    build.channelOverrides,
  );
}

function openGd77AssembledChannelsToRadioDtos(
  channels: readonly AssembledChannel[],
  build: RadioBuild,
  egress: RadioWireEgressIds,
  fkMaps?: RadioChannelFkMaps,
): AssembledChannelsToRadioDtosResult {
  const warnings: ExportWarning[] = [];
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const expandedRows = expandOpenGd77AssembledWireRows(channels, build, egress, warnings);
  const rowBySourceId = new Map(channels.map((row) => [row.entity.id, row]));
  const dtos: RadioChannelDto[] = [];
  let slotIndex = 1;

  for (const expansion of expandedRows) {
    const row = rowBySourceId.get(expansion.sourceChannelId);
    if (!row) continue;
    const entity = row.entity;
    const rxHz = entity.rxFrequency;
    if (rxHz == null || rxHz <= 0) continue;
    const profileAnalog =
      expansion.modeProfile.mode === 'fm' || expansion.modeProfile.mode === 'am'
        ? expansion.modeProfile
        : null;
    const txHz = entity.txFrequency ?? rxHz;
    const rxOnly = effectiveForbidTransmit(entity, merged.channelBehaviourContext);
    dtos.push({
      slotIndex,
      empty: false,
      wireName: expansion.wireName,
      rxHz,
      txHz,
      rxTone: channelToneToRadioTone(
        profileAnalog && 'rxTone' in profileAnalog ? profileAnalog.rxTone : 'none',
      ),
      txTone: channelToneToRadioTone(
        profileAnalog && 'txTone' in profileAnalog ? profileAnalog.txTone : 'none',
      ),
      powerPercent: entity.power,
      bandwidth: bandwidthFromAnalogProfile(profileAnalog ?? { mode: 'fm', bandwidthKHz: null }),
      ...(profileAnalog && 'squelch' in profileAnalog
        ? { squelchPercent: profileAnalog.squelch }
        : {}),
      ...(rxOnly ? { rxOnly: true } : {}),
      location: entity.location,
      useLocation: entity.useLocation,
      ...digitalFieldsFromExpandedWireRow(expansion, entity, fkMaps),
    });
    slotIndex += 1;
  }

  return { dtos: truncateToRadioCapacity(dtos, egress, warnings), warnings };
}

/** Map expanded OpenGD77 wire rows to 1-based slot numbers per source channel id. */
export function openGd77NumbersBySourceChannelId(
  channels: readonly AssembledChannel[],
  build: RadioBuild,
  egress: RadioWireEgressIds,
  warnings: ExportWarning[],
  maxSlots?: number,
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  const expandedRows = expandOpenGd77AssembledWireRows(channels, build, egress, warnings);
  let slotIndex = 1;
  for (const expansion of expandedRows) {
    const row = channels.find((r) => r.entity.id === expansion.sourceChannelId);
    if (!row) continue;
    const rxHz = row.entity.rxFrequency;
    if (rxHz == null || rxHz <= 0) continue;
    if (maxSlots != null && slotIndex > maxSlots) break;
    const list = map.get(expansion.sourceChannelId) ?? [];
    list.push(slotIndex);
    map.set(expansion.sourceChannelId, list);
    slotIndex += 1;
  }
  return map;
}

function digitalFieldsFromProjection(
  projection: ExpandedMxNChannelRow,
  channel: Channel,
  fkMaps?: RadioChannelFkMaps,
): Partial<RadioChannelDto> {
  const analog = channel.modeProfiles.find((p) => p.mode === 'fm' || p.mode === 'am');
  const dmr = isDmrProfile(projection.modeProfile) ? projection.modeProfile : null;
  let mode: RadioChannelMode | undefined;
  if (dmr && analog) mode = 'fixed-digital';
  else if (dmr) mode = 'digital';
  else if (analog) mode = 'analog';

  if (!dmr) {
    return { ...(mode ? { mode } : {}), ...aprsFieldsFromChannel(channel) };
  }

  const timeslot = dmr.timeslot === 2 ? 2 : dmr.timeslot === 1 ? 1 : undefined;
  const txContactId = resolveContactId(projection.txContactRef ?? dmr.contactRef, fkMaps);
  const rxGroupIndex = resolveRxGroupIndex(projection.rxGroupListId, fkMaps);
  const dmrRadioIdIndex = resolveDmrRadioIdIndex(dmr, fkMaps);
  return {
    mode: mode ?? 'digital',
    colorCode: dmr.colourCode ?? undefined,
    timeslot,
    dmrOperatingMode: resolveDmrOperatingMode(channel),
    ...(txContactId != null ? { txContactId } : {}),
    ...(rxGroupIndex != null ? { rxGroupIndex } : {}),
    ...(dmrRadioIdIndex != null ? { dmrRadioIdIndex } : {}),
    ...aprsFieldsFromChannel(channel),
  };
}

function truncateToRadioCapacity(
  dtos: RadioChannelDto[],
  egress: RadioWireEgressIds,
  warnings: ExportWarning[],
): RadioChannelDto[] {
  const limits = getProfileExportLimits(egress.formatId as FormatId, egress.profileId);
  const maxSlots = limits?.maxChannels;
  if (typeof maxSlots === 'number' && dtos.length > maxSlots) {
    pushGeneralWarning(
      warnings,
      `Expanded channel count ${dtos.length} exceeds radio capacity ${maxSlots}; truncating`,
    );
    return dtos.slice(0, maxSlots);
  }
  return dtos;
}

/**
 * Lean 1:1 map — used for non-MxN radios (UV-5R Mini, …).
 * Slot: `orderOrSlot` when set, else stable 1-based index in assemble order.
 * Empty / missing RX frequency → skipped (not written as empty slots).
 */
export function assembledChannelsToRadioDtos(
  channels: readonly AssembledChannel[],
  build: RadioBuild,
  egress: RadioWireEgressIds,
  library?: LibrarySlice,
): RadioChannelDto[] {
  return assembledChannelsToRadioDtosWithWarnings(
    channels,
    build,
    egress,
    undefined,
    undefined,
    library,
  ).dtos;
}

/**
 * `channels` may be a build-scoped subset of the library — when the caller has the full
 * library (real writes), pass it so name resolution/dedup matches preview and CSV export
 * exactly. Falls back to a library synthesised from just `channels` (dedup scoped to this
 * call only) when omitted, e.g. by unit tests constructing rows without a backing library.
 */
export function assembledChannelsToRadioDtosWithWarnings(
  channels: readonly AssembledChannel[],
  build: RadioBuild,
  egress: RadioWireEgressIds,
  fkMaps?: RadioChannelFkMaps,
  channelMemorySlots?: readonly ExportMemorySlot[],
  library?: LibrarySlice,
  options?: RadioChannelProjectionOptions,
): AssembledChannelsToRadioDtosResult {
  if (isOpenGd77RadioIoEgress(egress.profileId)) {
    return openGd77AssembledChannelsToRadioDtos(channels, build, egress, fkMaps);
  }

  const warnings: ExportWarning[] = [];
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const effectiveLibrary: LibrarySlice = library ?? {
    channels: channels.map((row) => row.entity),
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
  const resolutions = new Map(
    resolveWireNames({
      build,
      library: effectiveLibrary,
      entityKind: 'channel',
      formatId: egress.formatId,
      profileId: egress.profileId,
    }).map((resolution) => [resolution.libraryEntityId, resolution]),
  );
  const slotByChannelId = channelSlotIndexMap(channels, channelMemorySlots);
  const dtos: RadioChannelDto[] = [];
  const nxdnOptions = options?.nxdn === true ? { invalidRan: { count: 0 } } : undefined;
  let nxdnOnly = 0;
  let nxdnWithAnalog = 0;
  channels.forEach((row, index) => {
    const rxHz = row.entity.rxFrequency;
    if (rxHz == null || rxHz <= 0) return;
    const entity = row.entity;
    const analog = entity.modeProfiles.find((p) => p.mode === 'fm' || p.mode === 'am');
    const txHz = entity.txFrequency ?? rxHz;
    const slotIndex = slotByChannelId.get(entity.id) ?? index + 1;
    const rxOnly = effectiveForbidTransmit(entity, merged.channelBehaviourContext);
    const resolution = resolutions.get(entity.id);
    const wireName = resolution
      ? resolution.effective
      : row.wireNameOverride?.trim() || row.wireName;
    if (resolution) {
      pushWireNameResolutionWarning(warnings, {
        entityKind: 'Channel',
        remediation: resolution.remediation,
        original: resolution.override ?? resolution.libraryName,
        exported: resolution.effective,
        limit: resolution.limit,
        profileId: egress.profileId,
      });
    }
    dtos.push({
      slotIndex,
      empty: false,
      wireName,
      rxHz,
      txHz,
      rxTone: channelToneToRadioTone(analog && 'rxTone' in analog ? analog.rxTone : 'none'),
      txTone: channelToneToRadioTone(analog && 'txTone' in analog ? analog.txTone : 'none'),
      powerPercent: entity.power,
      bandwidth: bandwidthFromAnalogProfile(analog ?? { mode: 'fm', bandwidthKHz: null }),
      ...(analog && 'squelch' in analog ? { squelchPercent: analog.squelch } : {}),
      ...(rxOnly ? { rxOnly: true } : {}),
      ...digitalFieldsFromChannel(entity, fkMaps, nxdnOptions),
    });
    if (nxdnOptions && entity.modeProfiles.some(isNxdnProfile)) {
      const hasDmr = entity.modeProfiles.some(isDmrProfile);
      if (!hasDmr && !analog) nxdnOnly++;
      if (analog) nxdnWithAnalog++;
    }
  });
  if (nxdnOptions) {
    pushNxdnProjectionWarnings(warnings, {
      nxdnOnly,
      nxdnWithAnalog,
      invalidRan: nxdnOptions.invalidRan.count,
    });
  }
  return { dtos: truncateToRadioCapacity(dtos, egress, warnings), warnings };
}

function pushNxdnProjectionWarnings(
  warnings: ExportWarning[],
  counts: { nxdnOnly: number; nxdnWithAnalog: number; invalidRan: number },
): void {
  if (counts.nxdnOnly > 0) {
    pushGeneralWarning(
      warnings,
      `${counts.nxdnOnly} channel(s) have NXDN settings only. While the radio is on DMR they act as DMR channels with no contact.`,
    );
  }
  if (counts.nxdnWithAnalog > 0) {
    pushGeneralWarning(
      warnings,
      `${counts.nxdnWithAnalog} channel(s) have analogue and NXDN settings. While the radio is on NXDN they run as NXDN only; the analogue half is not used. While it is on DMR they act as digital channels with default DMR fields.`,
    );
  }
  if (counts.invalidRan > 0) {
    pushGeneralWarning(
      warnings,
      `${counts.invalidRan} NXDN RAN value(s) are outside 0-63 and were not written.`,
    );
  }
}

/**
 * Expand (when MxN) then map to RadioChannelDto — same projection as CPS export / preview.
 */
export function expandAssembledChannelsToRadioDtos(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: LibrarySlice,
  egress: RadioWireEgressIds,
  fkMaps?: RadioChannelFkMaps,
  options?: RadioChannelProjectionOptions,
): AssembledChannelsToRadioDtosResult {
  if (!hasMxNChannelExpansion(build.radioTargetId)) {
    return assembledChannelsToRadioDtosWithWarnings(
      assembled.channels,
      build,
      egress,
      fkMaps,
      assembled.channelMemorySlots,
      library,
      options,
    );
  }

  const warnings: ExportWarning[] = [];
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
  const dtos: RadioChannelDto[] = [];
  let slotIndex = 1;

  for (const projection of expanded) {
    const channel = channelById.get(projection.sourceChannelId);
    if (!channel) continue;
    const rxHz = channel.rxFrequency;
    if (rxHz == null || rxHz <= 0) continue;
    const analog = channel.modeProfiles.find((p) => p.mode === 'fm' || p.mode === 'am');
    const txHz = channel.txFrequency ?? rxHz;
    const rxOnly = effectiveForbidTransmit(channel, merged.channelBehaviourContext);
    dtos.push({
      slotIndex,
      empty: false,
      wireName: projection.wireName,
      rxHz,
      txHz,
      rxTone: channelToneToRadioTone(analog && 'rxTone' in analog ? analog.rxTone : 'none'),
      txTone: channelToneToRadioTone(analog && 'txTone' in analog ? analog.txTone : 'none'),
      powerPercent: channel.power,
      bandwidth: bandwidthFromAnalogProfile(analog ?? { mode: 'fm', bandwidthKHz: null }),
      ...(analog && 'squelch' in analog ? { squelchPercent: analog.squelch } : {}),
      ...(rxOnly ? { rxOnly: true } : {}),
      ...digitalFieldsFromProjection(projection, channel, fkMaps),
    });
    slotIndex += 1;
  }

  return { dtos: truncateToRadioCapacity(dtos, egress, warnings), warnings };
}

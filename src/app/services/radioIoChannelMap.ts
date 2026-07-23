/**
 * Map assemble() projection channels → radio-boundary DTOs for Web Serial encode.
 * Applies RadioBuild export name settings (profile nameLimit, shortenNames, …).
 * When the radio target has MxNChannelExpansion, fans out via expandAllMxNChannels
 * (same projection as CPS export / wire preview).
 * No framing — integrations radio modules consume RadioChannelDto only.
 */

import type { AssembledBuild, AssembledChannel, LibrarySlice } from '@core/services/assemble.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { Channel, ChannelModeProfile, ChannelTone } from '@core/models/library.ts';
import { channelPickForWireExport, composeChannelWireName } from '@core/domain/channelNaming.ts';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import { applyWireNameLimits } from '@core/import-export/channelExpansion/exportWireNames.ts';
import { expandAllMxNChannels } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import type { ExpandedMxNChannelRow } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { filterExpandedRowsByOverrides } from '@core/domain/formatBuildOverrides.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { getProfileExportLimits } from '@core/import-export/profileExportLimits.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
import type {
  RadioChannelDto,
  RadioChannelMode,
  RadioTone,
} from '@integrations/radio-io/radioChannelDto.ts';

export interface RadioWireEgressIds {
  formatId: string;
  profileId: string;
}

export interface AssembledChannelsToRadioDtosResult {
  dtos: RadioChannelDto[];
  warnings: string[];
}

/** Optional radio-native FK maps for TX-contact / RX-group indices. */
export interface RadioChannelFkMaps {
  contactIdByEntityId?: ReadonlyMap<string, number>;
  rxGroupIndexById?: ReadonlyMap<string, number>;
}

function resolveContactId(
  ref: { kind: string; id: string } | null | undefined,
  maps?: RadioChannelFkMaps,
): number | undefined {
  if (!ref || !maps?.contactIdByEntityId) return undefined;
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

function parseChannelTone(tone: ChannelTone | undefined): RadioTone {
  if (!tone || tone === 'none') return { kind: 'none' };
  const s = tone.trim();
  if (!s || s === '—' || s.toLowerCase() === 'none') return { kind: 'none' };
  if (s.includes('.')) {
    const hz = parseFloat(s);
    if (!Number.isNaN(hz)) return { kind: 'ctcss', hz };
  }
  const code = parseInt(s, 10);
  if (!Number.isNaN(code) && Number.isInteger(code)) return { kind: 'dcs', code };
  return { kind: 'none' };
}

function bandwidthFromKHz(bandwidthKHz: number | null | undefined): 'FM' | 'NFM' {
  if (bandwidthKHz == null) return 'FM';
  return bandwidthKHz <= 15 ? 'NFM' : 'FM';
}

function radioWireName(
  row: AssembledChannel,
  build: RadioBuild,
  egress: RadioWireEgressIds,
  reserved: Set<string>,
  warnings: string[],
): string {
  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const pick = channelPickForWireExport(row.entity, {
    nameModeOverride: merged.nameModeOverride as ChannelExportNameMode | undefined,
  });
  let base = row.wireNameOverride?.trim() ? row.wireName : composeChannelWireName(pick);
  const abbrev = row.entity.abbreviation?.trim();
  if (abbrev && merged.useChannelAbbreviation !== false) {
    base = composeChannelWireName({ ...pick, name: abbrev });
  }
  return applyWireNameLimits(
    base,
    row.entity,
    reserved,
    merged,
    merged.profileId ?? egress.profileId,
    warnings,
  );
}

function isDmrProfile(
  profile: ChannelModeProfile,
): profile is Extract<ChannelModeProfile, { mode: 'dmr' }> {
  return profile.mode === 'dmr';
}

function digitalFieldsFromChannel(
  channel: Channel,
  fkMaps?: RadioChannelFkMaps,
): Partial<RadioChannelDto> {
  const dmr = channel.modeProfiles.find((p) => p.mode === 'dmr');
  const analog = channel.modeProfiles.find((p) => p.mode === 'fm' || p.mode === 'am');
  let mode: RadioChannelMode | undefined;
  if (dmr && analog) mode = 'fixed-digital';
  else if (dmr) mode = 'digital';
  else if (analog) mode = 'analog';

  if (!dmr) {
    return mode ? { mode } : {};
  }

  const timeslot = dmr.timeslot === 2 ? 2 : dmr.timeslot === 1 ? 1 : undefined;
  const txContactId = resolveContactId(dmr.contactRef, fkMaps);
  const rxGroupIndex = resolveRxGroupIndex(dmr.rxGroupListId, fkMaps);
  return {
    mode: mode ?? 'digital',
    colorCode: dmr.colourCode ?? undefined,
    timeslot,
    ...(txContactId != null ? { txContactId } : {}),
    ...(rxGroupIndex != null ? { rxGroupIndex } : {}),
  };
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
    return mode ? { mode } : {};
  }

  const timeslot = dmr.timeslot === 2 ? 2 : dmr.timeslot === 1 ? 1 : undefined;
  const txContactId = resolveContactId(projection.txContactRef ?? dmr.contactRef, fkMaps);
  const rxGroupIndex = resolveRxGroupIndex(
    projection.rxGroupListId ?? dmr.rxGroupListId,
    fkMaps,
  );
  return {
    mode: mode ?? 'digital',
    colorCode: dmr.colourCode ?? undefined,
    timeslot,
    ...(txContactId != null ? { txContactId } : {}),
    ...(rxGroupIndex != null ? { rxGroupIndex } : {}),
  };
}

function truncateToRadioCapacity(
  dtos: RadioChannelDto[],
  egress: RadioWireEgressIds,
  warnings: string[],
): RadioChannelDto[] {
  const limits = getProfileExportLimits(egress.formatId as FormatId, egress.profileId);
  const maxSlots = limits?.maxChannels;
  if (typeof maxSlots === 'number' && dtos.length > maxSlots) {
    warnings.push(
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
): RadioChannelDto[] {
  return assembledChannelsToRadioDtosWithWarnings(channels, build, egress).dtos;
}

export function assembledChannelsToRadioDtosWithWarnings(
  channels: readonly AssembledChannel[],
  build: RadioBuild,
  egress: RadioWireEgressIds,
  fkMaps?: RadioChannelFkMaps,
): AssembledChannelsToRadioDtosResult {
  const reserved = new Set<string>();
  const warnings: string[] = [];
  const dtos: RadioChannelDto[] = [];
  channels.forEach((row, index) => {
    const rxHz = row.entity.rxFrequency;
    if (rxHz == null || rxHz <= 0) return;
    const analog = row.entity.modeProfiles.find((p) => p.mode === 'fm' || p.mode === 'am');
    const txHz = row.entity.txFrequency ?? rxHz;
    const slotIndex = row.orderOrSlot != null && row.orderOrSlot > 0 ? row.orderOrSlot : index + 1;
    dtos.push({
      slotIndex,
      empty: false,
      wireName: radioWireName(row, build, egress, reserved, warnings),
      rxHz,
      txHz,
      rxTone: parseChannelTone(analog && 'rxTone' in analog ? analog.rxTone : 'none'),
      txTone: parseChannelTone(analog && 'txTone' in analog ? analog.txTone : 'none'),
      powerPercent: row.entity.power,
      bandwidth: bandwidthFromKHz(analog && 'bandwidthKHz' in analog ? analog.bandwidthKHz : null),
      ...digitalFieldsFromChannel(row.entity, fkMaps),
    });
  });
  return { dtos: truncateToRadioCapacity(dtos, egress, warnings), warnings };
}

/**
 * Expand (when MxN) then map to RadioChannelDto — same projection as CPS export / preview.
 */
export function expandAssembledChannelsToRadioDtos(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: Pick<LibrarySlice, 'talkGroups' | 'digitalContacts'>,
  egress: RadioWireEgressIds,
  fkMaps?: RadioChannelFkMaps,
): AssembledChannelsToRadioDtosResult {
  if (!hasMxNChannelExpansion(build.radioTargetId)) {
    return assembledChannelsToRadioDtosWithWarnings(assembled.channels, build, egress, fkMaps);
  }

  const warnings: string[] = [];
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
  const dtos: RadioChannelDto[] = [];
  let slotIndex = 1;

  for (const projection of expanded) {
    const channel = channelById.get(projection.sourceChannelId);
    if (!channel) continue;
    const rxHz = channel.rxFrequency;
    if (rxHz == null || rxHz <= 0) continue;
    const analog = channel.modeProfiles.find((p) => p.mode === 'fm' || p.mode === 'am');
    const txHz = channel.txFrequency ?? rxHz;
    dtos.push({
      slotIndex,
      empty: false,
      wireName: projection.wireName,
      rxHz,
      txHz,
      rxTone: parseChannelTone(analog && 'rxTone' in analog ? analog.rxTone : 'none'),
      txTone: parseChannelTone(analog && 'txTone' in analog ? analog.txTone : 'none'),
      powerPercent: channel.power,
      bandwidth: bandwidthFromKHz(analog && 'bandwidthKHz' in analog ? analog.bandwidthKHz : null),
      ...digitalFieldsFromProjection(projection, channel, fkMaps),
    });
    slotIndex += 1;
  }

  return { dtos: truncateToRadioCapacity(dtos, egress, warnings), warnings };
}

import type { Channel, ChannelModeProfile, ChannelModeProfileDMR } from '@core/models/library.ts';
import type { DMRTimeSlot, EntityRef, ChannelMode } from '@core/models/libraryTypes.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { applyWireNameLimits } from '@core/import-export/channelExpansion/exportWireNames.ts';
import {
  expandMultiTalkGroupMemberWireRows,
  type MultiTalkGroupLibrarySlice,
} from '@core/import-export/channelExpansion/multiTalkGroup.ts';
import {
  expandChannelWireRows,
  type ExpandedChannelWireRow,
} from '@core/import-export/channelExpansion/multiMode.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import { uniqueWireName } from '@core/import-export/channelExpansion/shortenName.ts';
import { anytoneChannelWireName } from './exportChannelWire.ts';

export type AnytoneChannelRowKind = 'lean' | 'talkGroup' | 'scratch';

export interface ExpandedAnytoneChannelRow {
  sourceChannelId: string;
  key: string;
  wireName: string;
  mode: ChannelMode;
  modeProfile: ChannelModeProfile;
  txContactRef: EntityRef | null;
  rxGroupListId: string | null;
  rowKind: AnytoneChannelRowKind;
  expansionNote?: string;
}

function isDmrProfile(profile: ChannelModeProfile): profile is ChannelModeProfileDMR {
  return profile.mode === 'dmr';
}

function anytoneExportOptions(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): CpsExportOptions {
  return {
    ...options,
    profileId: options?.profileId ?? assembled.profileId,
    expandModes: false,
    expandRxGroupLists: options?.expandRxGroupLists ?? true,
    exportScratchChannels: options?.exportScratchChannels ?? true,
  };
}

function rxListMembersForChannel(
  dmrProfile: ChannelModeProfileDMR | null,
  assembled: AssembledBuild,
): Array<{
  ref: EntityRef;
  timeSlotOverride?: DMRTimeSlot | null;
}> {
  if (!dmrProfile?.rxGroupListId) return [];
  const list = assembled.rxGroupLists.find((r) => r.entity.id === dmrProfile.rxGroupListId);
  if (!list) return [];
  return list.entity.members;
}

function shouldSkipRxExpansion(
  dmrProfile: ChannelModeProfileDMR | null,
  options: CpsExportOptions,
): boolean {
  if (!dmrProfile?.rxGroupListId) return true;
  if (options.expandRxGroupLists === false) return true;
  return false;
}

function withTimeslot(
  profile: ChannelModeProfileDMR,
  timeSlotOverride: DMRTimeSlot | null | undefined,
): ChannelModeProfileDMR {
  return {
    ...profile,
    timeslot: timeSlotOverride ?? profile.timeslot ?? 1,
  };
}

function memberTimeslotOverride(
  members: Array<{ ref: EntityRef; timeSlotOverride?: DMRTimeSlot | null }>,
  memberRef: EntityRef,
): DMRTimeSlot | null | undefined {
  return members.find((entry) => entry.ref.kind === memberRef.kind && entry.ref.id === memberRef.id)
    ?.timeSlotOverride;
}

function scratchWireName(
  channel: Channel,
  baseWireName: string,
  reserved: Set<string>,
  options: CpsExportOptions,
  profileId: string | undefined,
  warnings: string[],
): string {
  const composed = `${baseWireName} Scratch`;
  if (options.shortenNames === false) {
    const name = sanitiseAsciiWireString(uniqueWireName(composed, reserved));
    reserved.add(name);
    return name;
  }
  return applyWireNameLimits(composed, channel, reserved, options, profileId, warnings);
}

function leanRow(
  channel: Channel,
  baseWireName: string,
  dmrProfile: ChannelModeProfileDMR,
): ExpandedAnytoneChannelRow {
  return {
    sourceChannelId: channel.id,
    key: channel.id,
    wireName: baseWireName,
    mode: dmrProfile.mode,
    modeProfile: dmrProfile,
    txContactRef: dmrProfile.contactRef,
    rxGroupListId: dmrProfile.rxGroupListId,
    rowKind: 'lean',
  };
}

function toLeanRows(siteRows: ExpandedChannelWireRow[]): ExpandedAnytoneChannelRow[] {
  return siteRows.map((row) => ({
    sourceChannelId: row.sourceChannelId,
    key: row.key,
    wireName: row.wireName,
    mode: row.mode,
    modeProfile: row.modeProfile,
    txContactRef: isDmrProfile(row.modeProfile) ? row.modeProfile.contactRef : null,
    rxGroupListId: isDmrProfile(row.modeProfile) ? row.modeProfile.rxGroupListId : null,
    rowKind: 'lean' as const,
  }));
}

function appendScratchRow(
  channel: Channel,
  baseWireName: string,
  dmrProfile: ChannelModeProfileDMR,
  rows: ExpandedAnytoneChannelRow[],
  exportOptions: CpsExportOptions,
  profileId: string | undefined,
  reserved: Set<string>,
  warnings: string[],
): void {
  if (exportOptions.exportScratchChannels === false) return;
  const hasTalkGroupRows = rows.some((row) => row.rowKind === 'talkGroup');
  if (!hasTalkGroupRows) return;

  rows.push({
    sourceChannelId: channel.id,
    key: `${channel.id}:scratch`,
    wireName: scratchWireName(channel, baseWireName, reserved, exportOptions, profileId, warnings),
    mode: dmrProfile.mode,
    modeProfile: dmrProfile,
    txContactRef: dmrProfile.contactRef,
    rxGroupListId: dmrProfile.rxGroupListId,
    rowKind: 'scratch',
    expansionNote: 'Scratch channel',
  });
}

/** Expand one channel into export wire rows (RX-list fan-out + optional scratch). */
export function expandAnytoneChannelWireRows(
  assembledChannel: AssembledBuild['channels'][number],
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  reserved = new Set<string>(),
  warnings: string[] = [],
): ExpandedAnytoneChannelRow[] {
  const exportOptions = anytoneExportOptions(assembled, options);
  const profileId = exportOptions.profileId;
  const channel = assembledChannel.entity;
  const siteWireName = anytoneChannelWireName(
    assembledChannel,
    { reserved, warnings },
    exportOptions,
    profileId,
  );
  const dmrProfile = channel.modeProfiles.find(isDmrProfile) ?? null;

  if (dmrProfile && !shouldSkipRxExpansion(dmrProfile, exportOptions)) {
    const members = rxListMembersForChannel(dmrProfile, assembled);
    if (members.length > 0) {
      const expanded = expandMultiTalkGroupMemberWireRows(
        channel,
        members,
        library,
        siteWireName,
        false,
        exportOptions,
        profileId,
        reserved,
        warnings,
      );
      const rows: ExpandedAnytoneChannelRow[] = expanded.map((row) => ({
        sourceChannelId: row.sourceChannelId,
        key: row.key,
        wireName: row.wireName,
        mode: row.mode,
        modeProfile: withTimeslot(dmrProfile, memberTimeslotOverride(members, row.memberRef)),
        txContactRef: row.memberRef,
        rxGroupListId: null,
        rowKind: 'talkGroup',
        expansionNote: row.expansionNote,
      }));
      appendScratchRow(
        channel,
        siteWireName,
        dmrProfile,
        rows,
        exportOptions,
        profileId,
        reserved,
        warnings,
      );
      return rows;
    }
  }

  if (dmrProfile) {
    return [leanRow(channel, siteWireName, dmrProfile)];
  }

  const analog = channel.modeProfiles.find(
    (profile) => profile.mode === 'fm' || profile.mode === 'am',
  );
  if (analog) {
    return [
      {
        sourceChannelId: channel.id,
        key: channel.id,
        wireName: siteWireName,
        mode: analog.mode,
        modeProfile: analog,
        txContactRef: null,
        rxGroupListId: null,
        rowKind: 'lean' as const,
      },
    ];
  }

  const siteRows = expandChannelWireRows(
    channel,
    siteWireName,
    false,
    exportOptions,
    profileId,
    reserved,
    warnings,
  );
  return toLeanRows(siteRows);
}

/** Expand all assembled channels for Anytone export, preserving order. */
export function expandAllAnytoneChannelsForExport(
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): ExpandedAnytoneChannelRow[] {
  const reserved = new Set<string>();
  const rows: ExpandedAnytoneChannelRow[] = [];
  for (const assembledChannel of assembled.channels) {
    rows.push(
      ...expandAnytoneChannelWireRows(
        assembledChannel,
        assembled,
        library,
        options,
        reserved,
        warnings,
      ),
    );
  }
  return rows;
}

/** Map channel id → expanded wire rows for zone member resolution. */
export function anytoneChannelExpansionById(
  expandedRows: ExpandedAnytoneChannelRow[],
): Map<string, ExpandedAnytoneChannelRow[]> {
  const map = new Map<string, ExpandedAnytoneChannelRow[]>();
  for (const row of expandedRows) {
    const list = map.get(row.sourceChannelId) ?? [];
    list.push(row);
    map.set(row.sourceChannelId, list);
  }
  return map;
}

/** Zone member wire names aligned with expanded channel rows. */
export function expandAnytoneZoneMemberWireNames(
  memberChannelIds: string[],
  expansionByChannelId: Map<string, ExpandedAnytoneChannelRow[]>,
): string[] {
  const names: string[] = [];
  for (const channelId of memberChannelIds) {
    const expanded = expansionByChannelId.get(channelId) ?? [];
    for (const row of expanded) {
      names.push(row.wireName);
    }
  }
  return names;
}

export type { MultiTalkGroupLibrarySlice };

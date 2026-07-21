import type { Channel, ChannelModeProfile, ChannelModeProfileDMR } from '@core/models/library.ts';
import type { EntityRef, ChannelMode } from '@core/models/libraryTypes.ts';
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

/** Same radio family as DM32 CPS — `ALL` is a sentinel listen-all list, not expandable members. */
export const NEONPLUG_NON_EXPANDABLE_RX_GROUP_LISTS = ['ALL'] as const;

export type NeonplugChannelRowKind = 'lean' | 'talkGroup' | 'scratch';

export interface ExpandedNeonplugChannelRow {
  sourceChannelId: string;
  key: string;
  wireName: string;
  mode: ChannelMode;
  modeProfile: ChannelModeProfile;
  /** TX contact for this row — member ref when RX-list expanded. */
  txContactRef: EntityRef | null;
  rxGroupListId: string | null;
  rowKind: NeonplugChannelRowKind;
  expansionNote?: string;
}

function isDmrProfile(profile: ChannelModeProfile): profile is ChannelModeProfileDMR {
  return profile.mode === 'dmr';
}

function isAnalogProfile(profile: ChannelModeProfile): boolean {
  return profile.mode === 'fm' || profile.mode === 'am' || profile.mode === 'ssb';
}

function dualModeRow(
  channel: Channel,
  baseWireName: string,
  dmrProfile: ChannelModeProfileDMR,
): ExpandedNeonplugChannelRow {
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

function neonplugExportOptions(
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
  timeSlotOverride?: import('@core/models/libraryTypes.ts').DMRTimeSlot | null;
}> {
  if (!dmrProfile?.rxGroupListId) return [];
  const list = assembled.rxGroupLists.find((r) => r.entity.id === dmrProfile.rxGroupListId);
  if (!list) return [];
  if (
    NEONPLUG_NON_EXPANDABLE_RX_GROUP_LISTS.includes(
      list.entity.name as (typeof NEONPLUG_NON_EXPANDABLE_RX_GROUP_LISTS)[number],
    )
  ) {
    return [];
  }
  return list.entity.members;
}

function shouldSkipRxExpansion(
  dmrProfile: ChannelModeProfileDMR | null,
  options: CpsExportOptions,
): boolean {
  if (!dmrProfile?.rxGroupListId) return true;
  if (options.expandRxGroupLists === false) return true;
  if (dmrProfile.contactRef && dmrProfile.rxGroupListId) return true;
  return false;
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

function appendScratchRow(
  channel: Channel,
  baseWireName: string,
  dmrProfile: ChannelModeProfileDMR,
  rows: ExpandedNeonplugChannelRow[],
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

function toLeanRows(siteRows: ExpandedChannelWireRow[]): ExpandedNeonplugChannelRow[] {
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

/** Expand one channel into export rows (RX-list fan-out + optional scratch). */
export function expandNeonplugChannelWireRows(
  assembledChannel: AssembledBuild['channels'][number],
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  reserved = new Set<string>(),
  warnings: string[] = [],
): ExpandedNeonplugChannelRow[] {
  const exportOptions = neonplugExportOptions(assembled, options);
  const profileId = exportOptions.profileId;
  const channel = assembledChannel.entity;
  const baseWireName = assembledChannel.wireNameOverride ?? assembledChannel.wireName;
  const dmrProfile = channel.modeProfiles.find(isDmrProfile) ?? null;

  if (!shouldSkipRxExpansion(dmrProfile, exportOptions)) {
    const members = rxListMembersForChannel(dmrProfile, assembled);
    if (members.length > 0 && dmrProfile) {
      const expanded = expandMultiTalkGroupMemberWireRows(
        channel,
        members,
        library,
        baseWireName,
        false,
        exportOptions,
        profileId,
        reserved,
        warnings,
      );
      const rows: ExpandedNeonplugChannelRow[] = expanded.map((row) => ({
        sourceChannelId: row.sourceChannelId,
        key: row.key,
        wireName: row.wireName,
        mode: row.mode,
        modeProfile: row.modeProfile,
        txContactRef: row.memberRef,
        rxGroupListId: null,
        rowKind: 'talkGroup' as const,
        expansionNote: row.expansionNote,
      }));
      appendScratchRow(
        channel,
        baseWireName,
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

  const fmProfile = channel.modeProfiles.find(isAnalogProfile) ?? null;
  if (channel.modeProfiles.length > 1 && dmrProfile && fmProfile) {
    return [dualModeRow(channel, baseWireName, dmrProfile)];
  }

  const siteRows = expandChannelWireRows(
    channel,
    baseWireName,
    false,
    exportOptions,
    profileId,
    reserved,
    warnings,
  );
  return toLeanRows(siteRows);
}

/** Expand all assembled channels for NeonPlug DM32UV export, preserving order. */
export function expandAllNeonplugChannelsForExport(
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): ExpandedNeonplugChannelRow[] {
  const reserved = new Set<string>();
  const rows: ExpandedNeonplugChannelRow[] = [];
  for (const assembledChannel of assembled.channels) {
    rows.push(
      ...expandNeonplugChannelWireRows(
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

/** Map channel id → expanded rows for zone / scan member resolution. */
export function neonplugChannelExpansionById(
  expandedRows: ExpandedNeonplugChannelRow[],
): Map<string, ExpandedNeonplugChannelRow[]> {
  const map = new Map<string, ExpandedNeonplugChannelRow[]>();
  for (const row of expandedRows) {
    const list = map.get(row.sourceChannelId) ?? [];
    list.push(row);
    map.set(row.sourceChannelId, list);
  }
  return map;
}

/**
 * Zone / scan member channel **numbers** aligned with expanded export rows.
 * `numbersBySourceChannelId` maps each library channel UUID to its projected NeonPlug numbers.
 */
export function expandNeonplugZoneMemberNumbers(
  memberChannelIds: readonly string[],
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>,
): number[] {
  const numbers: number[] = [];
  const seen = new Set<number>();
  for (const channelId of memberChannelIds) {
    const expanded = numbersBySourceChannelId.get(channelId) ?? [];
    for (const n of expanded) {
      if (seen.has(n)) continue;
      seen.add(n);
      numbers.push(n);
    }
  }
  return numbers;
}

export type { MultiTalkGroupLibrarySlice };

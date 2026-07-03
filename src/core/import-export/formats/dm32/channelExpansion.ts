import type {
  Channel,
  ChannelModeProfile,
  ChannelModeProfileDMR,
  DigitalContact,
  TalkGroup,
} from '@core/models/library.ts';
import type { EntityRef, ChannelMode } from '@core/models/libraryTypes.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import {
  expandMultiTalkGroupMemberWireRows,
  type MultiTalkGroupLibrarySlice,
} from '@core/import-export/channelExpansion/multiTalkGroup.ts';
import {
  expandChannelWireRows,
  type ExpandedChannelWireRow,
} from '@core/import-export/channelExpansion/multiMode.ts';
import { composeExportWireName } from '@core/import-export/channelExpansion/exportWireNames.ts';
import { DM32_NON_EXPANDABLE_RX_GROUP_LISTS } from './columns.ts';

export interface ExpandedDm32ChannelRow {
  sourceChannelId: string;
  key: string;
  wireName: string;
  mode: ChannelMode;
  modeProfile: ChannelModeProfile;
  /** TX contact for this row — member ref when RX-list expanded. */
  txContactRef: EntityRef | null;
  rxGroupListId: string | null;
}

function isDmrProfile(profile: ChannelModeProfile): profile is ChannelModeProfileDMR {
  return profile.mode === 'dmr';
}

function dm32ExportOptions(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): CpsExportOptions {
  return {
    ...options,
    profileId: options?.profileId ?? assembled.profileId,
    expandModes: false,
    expandRxGroupLists: options?.expandRxGroupLists ?? true,
  };
}

function rxListMembersForChannel(
  channel: Channel,
  dmrProfile: ChannelModeProfileDMR | null,
  assembled: AssembledBuild,
): Array<{ ref: EntityRef; timeSlotOverride?: import('@core/models/libraryTypes.ts').DMRTimeSlot | null }> {
  if (!dmrProfile?.rxGroupListId) return [];
  const list = assembled.rxGroupLists.find((r) => r.entity.id === dmrProfile.rxGroupListId);
  if (!list) return [];
  if (
    DM32_NON_EXPANDABLE_RX_GROUP_LISTS.includes(
      list.entity.name as (typeof DM32_NON_EXPANDABLE_RX_GROUP_LISTS)[number],
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

function toDm32Rows(
  siteRows: ExpandedChannelWireRow[],
  dmrProfile: ChannelModeProfileDMR | null,
): ExpandedDm32ChannelRow[] {
  return siteRows.map((row) => ({
    sourceChannelId: row.sourceChannelId,
    key: row.key,
    wireName: row.wireName,
    mode: row.mode,
    modeProfile: row.modeProfile,
    txContactRef: isDmrProfile(row.modeProfile) ? row.modeProfile.contactRef : null,
    rxGroupListId: isDmrProfile(row.modeProfile) ? row.modeProfile.rxGroupListId : null,
  }));
}

/** Expand one channel into export wire rows (RX-list fan-out when enabled). */
export function expandDm32ChannelWireRows(
  assembledChannel: AssembledBuild['channels'][number],
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  reserved = new Set<string>(),
  warnings: string[] = [],
): ExpandedDm32ChannelRow[] {
  const exportOptions = dm32ExportOptions(assembled, options);
  const profileId = exportOptions.profileId;
  const channel = assembledChannel.entity;
  const baseWireName = assembledChannel.wireNameOverride ?? assembledChannel.wireName;
  const dmrProfile = channel.modeProfiles.find(isDmrProfile) ?? null;

  if (!shouldSkipRxExpansion(dmrProfile, exportOptions)) {
    const members = rxListMembersForChannel(channel, dmrProfile, assembled);
    if (members.length > 0) {
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
      return expanded.map((row) => ({
        sourceChannelId: row.sourceChannelId,
        key: row.key,
        wireName: row.wireName,
        mode: row.mode,
        modeProfile: row.modeProfile,
        txContactRef: row.memberRef,
        rxGroupListId: null,
      }));
    }
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
  return toDm32Rows(siteRows, dmrProfile);
}

/** Expand all assembled channels for DM32 export, preserving order. */
export function expandAllDm32ChannelsForExport(
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): ExpandedDm32ChannelRow[] {
  const reserved = new Set<string>();
  const rows: ExpandedDm32ChannelRow[] = [];
  for (const assembledChannel of assembled.channels) {
    rows.push(
      ...expandDm32ChannelWireRows(
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
export function dm32ChannelExpansionById(
  expandedRows: ExpandedDm32ChannelRow[],
): Map<string, ExpandedDm32ChannelRow[]> {
  const map = new Map<string, ExpandedDm32ChannelRow[]>();
  for (const row of expandedRows) {
    const list = map.get(row.sourceChannelId) ?? [];
    list.push(row);
    map.set(row.sourceChannelId, list);
  }
  return map;
}

/** Zone member wire names aligned with expanded channel rows. */
export function expandDm32ZoneMemberWireNames(
  memberChannelIds: string[],
  expansionByChannelId: Map<string, ExpandedDm32ChannelRow[]>,
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

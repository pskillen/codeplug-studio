/**
 * Shared m×n expand-all for radio targets with MxNChannelExpansion.
 * Selected by radioTargetId / policy — not by egress format id.
 */

import type { Channel, ChannelModeProfile, ChannelModeProfileDMR } from '@core/models/library.ts';
import type { DMRTimeSlot, EntityRef, ChannelMode } from '@core/models/libraryTypes.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
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
import {
  mxnPolicyForRadioTarget,
  type MxNExpansionPolicy,
} from '@core/import-export/channelExpansion/mxnPolicy.ts';

export type MxNChannelRowKind = 'lean' | 'talkGroup' | 'scratch';

export interface ExpandedMxNChannelRow {
  sourceChannelId: string;
  key: string;
  wireName: string;
  mode: ChannelMode;
  modeProfile: ChannelModeProfile;
  /** TX contact for this row — member ref when RX-list expanded. */
  txContactRef: EntityRef | null;
  rxGroupListId: string | null;
  rowKind: MxNChannelRowKind;
  expansionNote?: string;
}

export interface ResolveMxNSiteWireNameContext {
  reserved: Set<string>;
  warnings: string[];
  willExpandRx: boolean;
  options: CpsExportOptions;
  profileId: string | undefined;
}

export interface ExpandAllMxNChannelsArgs {
  assembled: AssembledBuild;
  library: MultiTalkGroupLibrarySlice;
  radioTargetId: string;
  options?: CpsExportOptions;
  warnings?: string[];
  /**
   * Optional site-name composer (e.g. Anytone abbreviation path).
   * Default: `wireNameOverride ?? wireName`.
   */
  resolveSiteWireName?: (
    assembledChannel: AssembledChannel,
    ctx: ResolveMxNSiteWireNameContext,
  ) => string;
}

function isDmrProfile(profile: ChannelModeProfile): profile is ChannelModeProfileDMR {
  return profile.mode === 'dmr';
}

function isAnalogProfile(profile: ChannelModeProfile): boolean {
  return profile.mode === 'fm' || profile.mode === 'am' || profile.mode === 'ssb';
}

function mxnExportOptions(assembled: AssembledBuild, options?: CpsExportOptions): CpsExportOptions {
  return {
    ...options,
    profileId: options?.profileId ?? assembled.profileId,
    expandModes: false,
    expandRxGroupLists: options?.expandRxGroupLists ?? true,
    exportScratchChannels: options?.exportScratchChannels ?? true,
  };
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

function rxListMembersForChannel(
  dmrProfile: ChannelModeProfileDMR | null,
  assembled: AssembledBuild,
  policy: MxNExpansionPolicy,
): Array<{
  ref: EntityRef;
  timeSlotOverride?: DMRTimeSlot | null;
}> {
  if (!dmrProfile?.rxGroupListId) return [];
  const list = assembled.rxGroupLists.find((r) => r.entity.id === dmrProfile.rxGroupListId);
  if (!list) return [];
  if (policy.nonExpandableRxGroupListNames.includes(list.entity.name)) {
    return [];
  }
  return list.entity.members;
}

function shouldSkipRxExpansion(
  dmrProfile: ChannelModeProfileDMR | null,
  options: CpsExportOptions,
  policy: MxNExpansionPolicy,
): boolean {
  if (!dmrProfile?.rxGroupListId) return true;
  if (options.expandRxGroupLists === false) return true;
  if (policy.skipWhenContactAndRxList && dmrProfile.contactRef && dmrProfile.rxGroupListId) {
    return true;
  }
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
  rows: ExpandedMxNChannelRow[],
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

function dualModeDmrLeanRow(
  channel: Channel,
  baseWireName: string,
  dmrProfile: ChannelModeProfileDMR,
): ExpandedMxNChannelRow {
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

function leanDmrRow(
  channel: Channel,
  baseWireName: string,
  dmrProfile: ChannelModeProfileDMR,
): ExpandedMxNChannelRow {
  return dualModeDmrLeanRow(channel, baseWireName, dmrProfile);
}

function toLeanRows(siteRows: ExpandedChannelWireRow[]): ExpandedMxNChannelRow[] {
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

function defaultSiteWireName(assembledChannel: AssembledChannel): string {
  return assembledChannel.wireNameOverride ?? assembledChannel.wireName;
}

/** Expand one assembled channel into projection rows (RX-list fan-out + optional scratch). */
export function expandMxNChannelWireRows(
  assembledChannel: AssembledChannel,
  assembled: AssembledBuild,
  library: MultiTalkGroupLibrarySlice,
  policy: MxNExpansionPolicy,
  options?: CpsExportOptions,
  reserved = new Set<string>(),
  warnings: string[] = [],
  resolveSiteWireName?: ExpandAllMxNChannelsArgs['resolveSiteWireName'],
): ExpandedMxNChannelRow[] {
  const exportOptions = mxnExportOptions(assembled, options);
  const profileId = exportOptions.profileId;
  const channel = assembledChannel.entity;
  const dmrProfile = channel.modeProfiles.find(isDmrProfile) ?? null;
  const membersPreview = rxListMembersForChannel(dmrProfile, assembled, policy);
  const willExpandRx =
    dmrProfile != null &&
    !shouldSkipRxExpansion(dmrProfile, exportOptions, policy) &&
    membersPreview.length > 0;

  const siteWireName = resolveSiteWireName
    ? resolveSiteWireName(assembledChannel, {
        reserved,
        warnings,
        willExpandRx,
        options: exportOptions,
        profileId,
      })
    : defaultSiteWireName(assembledChannel);

  if (dmrProfile && !shouldSkipRxExpansion(dmrProfile, exportOptions, policy)) {
    const members = rxListMembersForChannel(dmrProfile, assembled, policy);
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
      const rows: ExpandedMxNChannelRow[] = expanded.map((row) => {
        const modeProfile = policy.applyMemberTimeslotOverride
          ? withTimeslot(dmrProfile, memberTimeslotOverride(members, row.memberRef))
          : row.modeProfile;
        return {
          sourceChannelId: row.sourceChannelId,
          key: row.key,
          wireName: row.wireName,
          mode: row.mode,
          modeProfile,
          txContactRef: row.memberRef,
          rxGroupListId: null,
          rowKind: 'talkGroup' as const,
          expansionNote: row.expansionNote,
        };
      });
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

  if (policy.collapseDualModeToDmrLean) {
    const fmProfile = channel.modeProfiles.find(isAnalogProfile) ?? null;
    if (channel.modeProfiles.length > 1 && dmrProfile && fmProfile) {
      return [dualModeDmrLeanRow(channel, siteWireName, dmrProfile)];
    }
  } else if (dmrProfile) {
    return [leanDmrRow(channel, siteWireName, dmrProfile)];
  } else {
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

/**
 * Expand all assembled channels for an MxN-capable radio target.
 * When the radio target lacks MxNChannelExpansion (or has no policy), returns lean rows only.
 */
export function expandAllMxNChannels(args: ExpandAllMxNChannelsArgs): ExpandedMxNChannelRow[] {
  const { assembled, library, radioTargetId, options, resolveSiteWireName } = args;
  const warnings = args.warnings ?? [];
  const policy = mxnPolicyForRadioTarget(radioTargetId);

  if (!hasMxNChannelExpansion(radioTargetId) || !policy) {
    const reserved = new Set<string>();
    const leanOptions = {
      ...options,
      profileId: options?.profileId ?? assembled.profileId,
      expandModes: false,
      expandRxGroupLists: false,
    };
    const rows: ExpandedMxNChannelRow[] = [];
    for (const assembledChannel of assembled.channels) {
      const siteWireName = resolveSiteWireName
        ? resolveSiteWireName(assembledChannel, {
            reserved,
            warnings,
            willExpandRx: false,
            options: leanOptions,
            profileId: leanOptions.profileId,
          })
        : defaultSiteWireName(assembledChannel);
      const siteRows = expandChannelWireRows(
        assembledChannel.entity,
        siteWireName,
        false,
        leanOptions,
        leanOptions.profileId,
        reserved,
        warnings,
      );
      rows.push(...toLeanRows(siteRows));
    }
    return rows;
  }

  const reserved = new Set<string>();
  const rows: ExpandedMxNChannelRow[] = [];
  for (const assembledChannel of assembled.channels) {
    rows.push(
      ...expandMxNChannelWireRows(
        assembledChannel,
        assembled,
        library,
        policy,
        options,
        reserved,
        warnings,
        resolveSiteWireName,
      ),
    );
  }
  return rows;
}

/** Map channel id → expanded wire rows for zone member resolution. */
export function mxnExpansionByChannelId(
  expandedRows: ExpandedMxNChannelRow[],
): Map<string, ExpandedMxNChannelRow[]> {
  const map = new Map<string, ExpandedMxNChannelRow[]>();
  for (const row of expandedRows) {
    const list = map.get(row.sourceChannelId) ?? [];
    list.push(row);
    map.set(row.sourceChannelId, list);
  }
  return map;
}

/** Zone member wire names aligned with expanded channel rows. */
export function expandMxNZoneMemberWireNames(
  memberChannelIds: string[],
  expansionByChannelId: Map<string, ExpandedMxNChannelRow[]>,
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

/**
 * Zone / scan member channel **numbers** aligned with expanded export rows
 * (NeonPlug number fan-out). Kept here so format adapters do not own fan-out maths.
 */
export function expandMxNZoneMemberNumbers(
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
export type { MxNExpansionPolicy, MxNExpansionPolicyId } from './mxnPolicy.ts';
export { mxnPolicyForRadioTarget } from './mxnPolicy.ts';

import type {
  Channel,
  ChannelModeProfile,
  DigitalContact,
  TalkGroup,
} from '@core/models/library.ts';
import type { DMRTimeSlot, EntityRef, ChannelMode } from '@core/models/libraryTypes.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  channelPickForWireExport,
  composeChannelWireName,
  type ChannelExportNameMode,
} from '@core/domain/channelNaming.ts';
import {
  applyWireNameLimits,
  composeExportWireName,
  resolveMaxNameLength,
} from './exportWireNames.ts';
import { entityRefDisplayName, entityRefExportLabel } from './entityRefExport.ts';
import { expandChannelWireRows, type ExpandedChannelWireRow } from './multiMode.ts';
import {
  composeMultiTalkGroupWireName,
  DEFAULT_MULTI_TG_EXPORT_NAME_MODE,
  escalateMultiTalkGroupExportNameMode,
  multiTalkGroupProtectedSuffix,
  type MultiTalkGroupExportNameMode,
} from './multiTalkGroupWireName.ts';
import { modeExportNameSuffix } from './modeExportSuffix.ts';
import { finalizeWireName, type TalkGroupMemberSuffixReplacement } from './shortenName.ts';
import { sanitiseAsciiWireString } from '../sanitiseAsciiWireString.ts';

export interface MultiTalkGroupLibrarySlice {
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
}

export interface ExpandedMultiTalkGroupWireRow {
  sourceChannelId: string;
  key: string;
  wireName: string;
  mode: ChannelMode;
  modeProfile: ChannelModeProfile;
  memberRef: EntityRef;
  expansionNote?: string;
}

export function multiTalkGroupMemberWireKey(
  channelId: string,
  mode: ChannelMode,
  memberRef: EntityRef,
): string {
  return `${channelId}:${modeExportNameSuffix(mode)}:${memberRef.kind}:${memberRef.id}`;
}

function wireNameContext(
  library: MultiTalkGroupLibrarySlice,
  siteWireName: string,
  timeSlotOverride: DMRTimeSlot | null | undefined,
  options?: CpsExportOptions,
) {
  return {
    talkGroups: library.talkGroups,
    digitalContacts: library.digitalContacts,
    useTalkGroupAbbreviation: options?.useTalkGroupAbbreviation,
    nameModeOverride: options?.nameModeOverride as ChannelExportNameMode | undefined,
    siteWireName,
    memberTimeSlotOverride: timeSlotOverride,
  };
}

function composeWithEscalation(
  channel: Channel,
  member: EntityRef,
  library: MultiTalkGroupLibrarySlice,
  siteWireName: string,
  timeSlotOverride: DMRTimeSlot | null | undefined,
  options: CpsExportOptions | undefined,
): { base: string; mode: MultiTalkGroupExportNameMode; fixedSuffix: string | undefined } {
  let effectiveMode = options?.multiTalkGroupExportNameMode ?? DEFAULT_MULTI_TG_EXPORT_NAME_MODE;
  const ctx = wireNameContext(library, siteWireName, timeSlotOverride, options);

  if (effectiveMode === 'append') {
    const fullMemberName = entityRefDisplayName(
      member,
      library.talkGroups,
      library.digitalContacts,
    );
    return {
      base: fullMemberName ? `${siteWireName} ${fullMemberName}` : siteWireName,
      mode: effectiveMode,
      fixedSuffix: undefined,
    };
  }

  let base = composeMultiTalkGroupWireName(channel, member, effectiveMode, ctx);
  let fixedSuffix = multiTalkGroupProtectedSuffix(channel, member, effectiveMode, ctx);
  const maxLen = resolveMaxNameLength(options?.profileId, options);

  while (maxLen != null && base.length > maxLen) {
    const next = escalateMultiTalkGroupExportNameMode(effectiveMode);
    if (!next) break;
    effectiveMode = next;
    base = composeMultiTalkGroupWireName(channel, member, effectiveMode, ctx);
    fixedSuffix = multiTalkGroupProtectedSuffix(channel, member, effectiveMode, ctx);
  }

  return { base, mode: effectiveMode, fixedSuffix };
}

function talkGroupMemberSuffixForAppend(
  member: EntityRef,
  library: MultiTalkGroupLibrarySlice,
  options: CpsExportOptions | undefined,
  tgMode: MultiTalkGroupExportNameMode,
): TalkGroupMemberSuffixReplacement | undefined {
  if (tgMode !== 'append' || options?.useTalkGroupAbbreviation === false) return undefined;
  const fullMemberName = entityRefDisplayName(member, library.talkGroups, library.digitalContacts);
  const exportMemberLabel = entityRefExportLabel(
    member,
    library.talkGroups,
    library.digitalContacts,
    { useAbbreviation: true },
  );
  if (!fullMemberName || !exportMemberLabel || exportMemberLabel === fullMemberName) {
    return undefined;
  }
  return { full: fullMemberName, abbreviated: exportMemberLabel };
}

/** Shorten a composed multi-TG wire name, applying TG abbreviation before dictionary steps. */
export function applyMultiTalkGroupWireNameLimits(
  channel: Channel,
  member: EntityRef,
  library: MultiTalkGroupLibrarySlice,
  siteWireName: string,
  timeSlotOverride: DMRTimeSlot | null | undefined,
  reserved: Set<string>,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: string[],
): string {
  const { base, mode, fixedSuffix } = composeWithEscalation(
    channel,
    member,
    library,
    siteWireName,
    timeSlotOverride,
    { ...options, profileId: profileId ?? options?.profileId },
  );

  const maxLen = resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;

  if (!shorten || maxLen == null) {
    return applyWireNameLimits(base, channel, reserved, options, profileId, warnings);
  }

  const pick = channelPickForWireExport(channel, {
    nameModeOverride: options?.nameModeOverride as ChannelExportNameMode | undefined,
  });
  const channelAbbrev = channel.abbreviation?.trim();
  const recomposeWithChannelAbbreviation =
    channelAbbrev && options?.useChannelAbbreviation !== false
      ? () => composeChannelWireName({ ...pick, name: channelAbbrev })
      : undefined;

  const tgSuffix = talkGroupMemberSuffixForAppend(member, library, options, mode);

  return sanitiseAsciiWireString(
    finalizeWireName(
      base,
      reserved,
      maxLen,
      {
        exportNameMode: pick.exportNameMode,
        recomposeWithMode: (m) => composeChannelWireName({ ...pick, exportNameMode: m }),
        recomposeWithChannelAbbreviation,
        talkGroupMemberSuffix: tgSuffix,
        fixedSuffix,
      },
      warnings,
    ),
  );
}

/** One multi-TG expanded row from a site wire name (post multi-mode suffix) and RX-list member. */
export function expandMultiTalkGroupMemberWireRow(
  channel: Channel,
  member: EntityRef,
  library: MultiTalkGroupLibrarySlice,
  siteRow: ExpandedChannelWireRow,
  timeSlotOverride: DMRTimeSlot | null | undefined,
  options?: CpsExportOptions,
  profileId?: string,
  reserved = new Set<string>(),
  warnings: string[] = [],
): ExpandedMultiTalkGroupWireRow {
  const wireName = applyMultiTalkGroupWireNameLimits(
    channel,
    member,
    library,
    siteRow.wireName,
    timeSlotOverride,
    reserved,
    options,
    profileId,
    warnings,
  );

  return {
    sourceChannelId: channel.id,
    key: multiTalkGroupMemberWireKey(channel.id, siteRow.mode, member),
    wireName,
    mode: siteRow.mode,
    modeProfile: siteRow.modeProfile,
    memberRef: member,
    expansionNote: `Multi-talkgroup member (${member.kind})`,
  };
}

/**
 * Expand mode-expanded site rows into one wire row per RX-list member (m×n when multi-mode).
 */
export function expandMultiTalkGroupMemberWireRows(
  channel: Channel,
  members: Array<{ ref: EntityRef; timeSlotOverride?: DMRTimeSlot | null }>,
  library: MultiTalkGroupLibrarySlice,
  siteWireName: string | undefined,
  expandModes = true,
  options?: CpsExportOptions,
  profileId?: string,
  reserved = new Set<string>(),
  warnings: string[] = [],
): ExpandedMultiTalkGroupWireRow[] {
  const siteRows = expandChannelWireRows(
    channel,
    siteWireName?.trim() || composeExportWireName(channel, options),
    expandModes,
    options,
    profileId,
    reserved,
    warnings,
  );

  const rows: ExpandedMultiTalkGroupWireRow[] = [];
  for (const siteRow of siteRows) {
    for (const member of members) {
      const fullName = entityRefDisplayName(
        member.ref,
        library.talkGroups,
        library.digitalContacts,
      );
      if (!fullName) continue;
      rows.push(
        expandMultiTalkGroupMemberWireRow(
          channel,
          member.ref,
          library,
          siteRow,
          member.timeSlotOverride,
          options,
          profileId,
          reserved,
          warnings,
        ),
      );
    }
  }
  return rows;
}

export {
  DEFAULT_MULTI_TG_EXPORT_NAME_MODE,
  type MultiTalkGroupExportNameMode,
} from './multiTalkGroupWireName.ts';

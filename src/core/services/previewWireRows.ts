import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  isEntityExcluded,
  isEntityForceIncluded,
  overrideByEntityId,
  type OverrideField,
} from '@core/domain/formatBuildOverrides.ts';
import { channelDisplayLabel, defaultChannelWireName } from '@core/domain/channelNaming.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import { expandAllDm32ChannelsForExport } from '@core/import-export/formats/dm32/channelExpansion.ts';
import {
  expandChannelWireRows,
  modeExportNameSuffix,
} from '@core/import-export/channelExpansion/multiMode.ts';
import { applyTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import {
  assemble,
  channelInAnyZoneMembership,
  zoneLinkedChannelIds,
  type LibrarySlice,
} from './assemble.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Channel, ChannelModeProfileDMR, Zone } from '@core/models/library.ts';
import type { DMRTimeSlot, EntityRef } from '@core/models/libraryTypes.ts';
import { directZoneMemberChannelIds, directZoneMemberZoneIds } from '@core/domain/zoneMembers.ts';
import { isChirpAnalogueExportable } from '@core/import-export/formats/chirp/channelWire.ts';
import { previewGeneratedChannelWireName } from './previewChannelWireName.ts';

export type WirePreviewEntityKind =
  'channel' | 'zone' | 'scanList' | 'talkGroup' | 'contact' | 'rxGroupList';

export const PREVIEW_ROW_NOT_REFERENCED_NOTE = 'Not referenced by exported channels';

export const PREVIEW_ROW_NOT_ZONE_LINKED_NOTE = 'Not linked to a zone';

export const PREVIEW_ROW_NOT_IN_MEMORY_LIST_NOTE = 'Not in memory list';

export const PREVIEW_ROW_NOT_ANALOGUE_CHIRP_NOTE = 'Not analogue — skipped on CHIRP export';

export const PREVIEW_ROW_OMIT_FROM_EXPORT_NOTE =
  'Not exported as its own zone — channels still export inside parent zones (library setting)';

/** Optional sub-lines under the display name — expansion context for wire naming. */
export interface WirePreviewDisplayLine {
  label: string;
  value: string;
}

/** Direct zone members for wire-preview badges (channels and nested zones). */
export interface WirePreviewZoneDirectMembers {
  channelCount: number;
  zoneCount: number;
  channelNames: string[];
  zoneNames: string[];
}

export interface WirePreviewRow {
  /** Stable key for override storage — library entity id, or composite for expansion rows. */
  key: string;
  libraryEntityId: string;
  entityKind: WirePreviewEntityKind;
  displayLabel: string;
  generatedWireName: string;
  effectiveWireName: string;
  /** True when the build stores an explicit wireName override for this row key. */
  hasWireNameOverride: boolean;
  excluded: boolean;
  expansionNote?: string;
  displayDetails?: WirePreviewDisplayLine[];
  /** Library zone flagged omitFromExport — no standalone Zones.csv row. */
  omitFromExport?: boolean;
  /** Per-build override: export standalone zone despite library omitFromExport. */
  forceInclude?: boolean;
  /** Direct library zone members — zones wire preview only. */
  zoneDirectMembers?: WirePreviewZoneDirectMembers;
}

export function overrideFieldForEntityKind(entityKind: WirePreviewEntityKind): OverrideField {
  switch (entityKind) {
    case 'channel':
      return 'channelOverrides';
    case 'zone':
      return 'zoneOverrides';
    case 'scanList':
      return 'scanListOverrides';
    case 'talkGroup':
      return 'talkGroupOverrides';
    case 'contact':
      return 'contactOverrides';
    case 'rxGroupList':
      return 'rxGroupListOverrides';
  }
}

function zoneDirectMembersPreview(zone: Zone, library: LibrarySlice): WirePreviewZoneDirectMembers {
  const channelIds = directZoneMemberChannelIds(zone);
  const zoneIds = directZoneMemberZoneIds(zone);
  const channelById = new Map(library.channels.map((ch) => [ch.id, ch]));
  const zoneById = new Map(library.zones.map((row) => [row.id, row]));
  return {
    channelCount: channelIds.length,
    zoneCount: zoneIds.length,
    channelNames: channelIds.map((id) => {
      const ch = channelById.get(id);
      return ch ? channelDisplayLabel(ch) : id;
    }),
    zoneNames: zoneIds.map((id) => zoneById.get(id)?.name ?? id),
  };
}

function previewRow(
  key: string,
  libraryEntityId: string,
  entityKind: WirePreviewEntityKind,
  displayLabel: string,
  generatedWireName: string,
  overrides: FormatBuild[OverrideField],
  expansionNote?: string,
  displayDetails?: WirePreviewDisplayLine[],
): WirePreviewRow {
  const override = overrideByEntityId(overrides).get(key);
  const excluded = override?.excluded === true;
  const wireNameOverride = override?.wireName?.trim();
  const effectiveWireName = sanitiseAsciiWireString(wireNameOverride || generatedWireName);
  return {
    key,
    libraryEntityId,
    entityKind,
    displayLabel,
    generatedWireName: sanitiseAsciiWireString(generatedWireName),
    effectiveWireName,
    hasWireNameOverride: Boolean(wireNameOverride),
    excluded,
    expansionNote,
    displayDetails,
  };
}

function isDmrProfile(profile: Channel['modeProfiles'][number]): profile is ChannelModeProfileDMR {
  return profile.mode === 'dmr';
}

function rxListMemberTimeslot(
  channel: Channel,
  memberRef: EntityRef,
  library: LibrarySlice,
): DMRTimeSlot {
  const dmrProfile = channel.modeProfiles.find(isDmrProfile);
  if (!dmrProfile?.rxGroupListId) return dmrProfile?.timeslot ?? 1;
  const list = library.rxGroupLists.find((row) => row.id === dmrProfile.rxGroupListId);
  const member = list?.members.find(
    (entry) => entry.ref.kind === memberRef.kind && entry.ref.id === memberRef.id,
  );
  return member?.timeSlotOverride ?? dmrProfile.timeslot ?? 1;
}

function dm32RxListFanOutDisplayDetails(
  channel: Channel,
  txContactRef: EntityRef | null,
  library: LibrarySlice,
): WirePreviewDisplayLine[] | undefined {
  if (txContactRef?.kind !== 'talkGroup') return undefined;
  const talkGroup = library.talkGroups.find((row) => row.id === txContactRef.id);
  if (!talkGroup) return undefined;
  const timeslot = rxListMemberTimeslot(channel, txContactRef, library);
  return [
    { label: 'Channel', value: channel.name.trim() || channelDisplayLabel(channel) },
    {
      label: 'Talk group',
      value: `${talkGroup.name} (${talkGroup.digitalId}) · Slot ${timeslot}`,
    },
  ];
}

export function previewWireRows(
  build: FormatBuild,
  library: LibrarySlice,
  entityKind: WirePreviewEntityKind,
  _options?: CpsExportOptions,
): WirePreviewRow[] {
  const projection = assemble(build, library, { profileId: _options?.profileId });

  switch (entityKind) {
    case 'channel': {
      const expandModes = build.formatId === 'dm32' ? false : (_options?.expandModes ?? true);
      const rows: WirePreviewRow[] = [];
      const reserved = new Set<string>();
      const warnings: string[] = [];

      if (build.formatId === 'chirp') {
        const memorySlots =
          projection.channelMemorySlots ??
          projection.channels.map((row, index) => ({
            slot: index + 1,
            channelId: row.entity.id,
          }));
        const memoryIds = memorySlots
          .map((slot) => slot.channelId)
          .filter((id): id is string => id != null);
        const memorySet = new Set(memoryIds);
        const rows: WirePreviewRow[] = [];

        const pushChannelRow = (channel: Channel, expansionNote?: string) => {
          const channelOverride = overrideByEntityId(build.channelOverrides)
            .get(channel.id)
            ?.wireName?.trim();
          const generatedWireName = previewGeneratedChannelWireName(channel, build, _options);
          rows.push({
            key: channel.id,
            libraryEntityId: channel.id,
            entityKind: 'channel',
            displayLabel: channelDisplayLabel(channel),
            generatedWireName: sanitiseAsciiWireString(generatedWireName),
            effectiveWireName: sanitiseAsciiWireString(channelOverride ?? generatedWireName),
            hasWireNameOverride: Boolean(channelOverride),
            excluded: isEntityExcluded(build.channelOverrides, channel.id),
            expansionNote,
          });
        };

        memorySlots.forEach((slot) => {
          if (!slot.channelId) return;
          const channel = library.channels.find((row) => row.id === slot.channelId);
          if (!channel) return;
          if (!isChirpAnalogueExportable(channel)) return;
          pushChannelRow(channel, `Location ${slot.slot}`);
        });

        for (const channel of library.channels) {
          if (memorySet.has(channel.id)) continue;
          if (!isChirpAnalogueExportable(channel)) continue;
          pushChannelRow(channel, PREVIEW_ROW_NOT_IN_MEMORY_LIST_NOTE);
        }

        return rows;
      }

      if (build.formatId === 'dm32') {
        const assembled = projection;
        const dm32Options = {
          ..._options,
          expandModes: false,
          expandRxGroupLists: _options?.expandRxGroupLists ?? true,
          profileId: _options?.profileId ?? build.profileId,
        };
        const expanded = expandAllDm32ChannelsForExport(assembled, library, dm32Options, warnings);
        for (const generated of expanded) {
          const channel = library.channels.find((c) => c.id === generated.sourceChannelId);
          if (!channel) continue;
          const channelOverride = overrideByEntityId(build.channelOverrides)
            .get(channel.id)
            ?.wireName?.trim();
          const keyOverride = overrideByEntityId(build.channelOverrides)
            .get(generated.key)
            ?.wireName?.trim();
          rows.push({
            key: generated.key,
            libraryEntityId: channel.id,
            entityKind: 'channel',
            displayLabel: channelDisplayLabel(channel),
            generatedWireName: sanitiseAsciiWireString(generated.wireName),
            effectiveWireName: sanitiseAsciiWireString(
              keyOverride ?? channelOverride ?? generated.wireName,
            ),
            hasWireNameOverride: Boolean(keyOverride ?? channelOverride),
            excluded: isEntityExcluded(build.channelOverrides, channel.id),
            expansionNote: generated.expansionNote,
            displayDetails: generated.expansionNote
              ? dm32RxListFanOutDisplayDetails(channel, generated.txContactRef, library)
              : undefined,
          });
        }
        const exportedChannelIds = new Set(projection.channels.map((row) => row.entity.id));
        for (const channel of library.channels) {
          if (exportedChannelIds.has(channel.id)) continue;
          const channelOverride = overrideByEntityId(build.channelOverrides)
            .get(channel.id)
            ?.wireName?.trim();
          const generatedWireName = defaultChannelWireName(channel);
          rows.push({
            key: channel.id,
            libraryEntityId: channel.id,
            entityKind: 'channel',
            displayLabel: channelDisplayLabel(channel),
            generatedWireName: sanitiseAsciiWireString(generatedWireName),
            effectiveWireName: sanitiseAsciiWireString(channelOverride ?? generatedWireName),
            hasWireNameOverride: Boolean(channelOverride),
            excluded: isEntityExcluded(build.channelOverrides, channel.id),
            expansionNote: PREVIEW_ROW_NOT_ZONE_LINKED_NOTE,
          });
        }
        return rows;
      }

      if (build.formatId === 'anytone') {
        const zoneLinkedForPreview =
          build.exportUnlinkedChannels === false ? zoneLinkedChannelIds(build, library) : null;
        for (const assembledRow of projection.channels) {
          const channel = assembledRow.entity;
          const channelOverride = overrideByEntityId(build.channelOverrides)
            .get(channel.id)
            ?.wireName?.trim();
          const generatedWireName = assembledRow.wireName;
          rows.push({
            key: channel.id,
            libraryEntityId: channel.id,
            entityKind: 'channel',
            displayLabel: channelDisplayLabel(channel),
            generatedWireName: sanitiseAsciiWireString(generatedWireName),
            effectiveWireName: sanitiseAsciiWireString(channelOverride ?? generatedWireName),
            hasWireNameOverride: Boolean(channelOverride),
            excluded: isEntityExcluded(build.channelOverrides, channel.id),
            expansionNote:
              zoneLinkedForPreview && !zoneLinkedForPreview.has(channel.id)
                ? PREVIEW_ROW_NOT_ZONE_LINKED_NOTE
                : undefined,
          });
        }
        const exportedChannelIds = new Set(projection.channels.map((row) => row.entity.id));
        for (const channel of library.channels) {
          if (exportedChannelIds.has(channel.id)) continue;
          const channelOverride = overrideByEntityId(build.channelOverrides)
            .get(channel.id)
            ?.wireName?.trim();
          const generatedWireName = defaultChannelWireName(channel);
          rows.push({
            key: channel.id,
            libraryEntityId: channel.id,
            entityKind: 'channel',
            displayLabel: channelDisplayLabel(channel),
            generatedWireName: sanitiseAsciiWireString(generatedWireName),
            effectiveWireName: sanitiseAsciiWireString(channelOverride ?? generatedWireName),
            hasWireNameOverride: Boolean(channelOverride),
            excluded: isEntityExcluded(build.channelOverrides, channel.id),
            expansionNote: PREVIEW_ROW_NOT_ZONE_LINKED_NOTE,
          });
        }
        return rows;
      }

      const zoneLinkedForPreview =
        build.exportUnlinkedChannels === false ? zoneLinkedChannelIds(build, library) : null;

      for (const channel of library.channels) {
        const generatedExpansions = expandChannelWireRows(
          channel,
          undefined,
          expandModes,
          _options,
          build.profileId,
          reserved,
          warnings,
        );
        const channelOverride = overrideByEntityId(build.channelOverrides)
          .get(channel.id)
          ?.wireName?.trim();
        for (const generated of generatedExpansions) {
          const keyOverride = overrideByEntityId(build.channelOverrides)
            .get(generated.key)
            ?.wireName?.trim();
          const generatedWireName = generated.wireName;
          const excluded = isEntityExcluded(build.channelOverrides, channel.id);
          const hasWireNameOverride = Boolean(keyOverride ?? channelOverride);
          rows.push({
            key: generated.key,
            libraryEntityId: channel.id,
            entityKind: 'channel',
            displayLabel:
              generatedExpansions.length > 1
                ? `${channelDisplayLabel(channel)} (${generated.mode.toUpperCase()})`
                : channelDisplayLabel(channel),
            generatedWireName: sanitiseAsciiWireString(generatedWireName),
            effectiveWireName: sanitiseAsciiWireString(
              keyOverride ?? channelOverride ?? generatedWireName,
            ),
            hasWireNameOverride,
            excluded,
            expansionNote:
              generatedExpansions.length > 1
                ? `Multi-mode ${modeExportNameSuffix(generated.mode)} row`
                : zoneLinkedForPreview && !zoneLinkedForPreview.has(channel.id)
                  ? PREVIEW_ROW_NOT_ZONE_LINKED_NOTE
                  : undefined,
          });
        }
      }
      return rows;
    }
    case 'zone':
      return library.zones.map((zone) => {
        const omitFromExport = zone.omitFromExport === true;
        const forceInclude = isEntityForceIncluded(build.zoneOverrides, zone.id);
        const zoneDirectMembers = zoneDirectMembersPreview(zone, library);
        return {
          ...previewRow(
            zone.id,
            zone.id,
            'zone',
            zone.name,
            zone.name,
            build.zoneOverrides,
            omitFromExport ? PREVIEW_ROW_OMIT_FROM_EXPORT_NOTE : undefined,
          ),
          omitFromExport,
          forceInclude,
          zoneDirectMembers,
        };
      });
    case 'scanList': {
      return library.scanLists.map((entry) => {
        const assembled = projection.scanLists.find((row) => row.scanListId === entry.id);
        const memberCount = entry.memberChannelIds.length;
        return previewRow(
          entry.id,
          entry.id,
          'scanList',
          `${entry.name} (${memberCount} channels)`,
          entry.name,
          build.scanListOverrides,
          assembled && memberCount > 0 ? undefined : 'No channels in scan list',
        );
      });
    }
    case 'talkGroup': {
      const reserved = new Set<string>();
      const warnings: string[] = [];
      return library.talkGroups.map((talkGroup) => {
        const assembled = projection.talkGroups.find((row) => row.entity.id === talkGroup.id);
        const referenced = assembled != null;
        const baseWireName = talkGroup.name;
        const generatedWireName = applyTalkGroupWireNameLimits(
          baseWireName,
          talkGroup,
          reserved,
          _options,
          build.profileId,
          warnings,
        );
        return previewRow(
          talkGroup.id,
          talkGroup.id,
          'talkGroup',
          `${talkGroup.name} (ID ${talkGroup.digitalId})`,
          generatedWireName,
          build.talkGroupOverrides,
          referenced ? undefined : PREVIEW_ROW_NOT_REFERENCED_NOTE,
        );
      });
    }
    case 'contact': {
      const rows: WirePreviewRow[] = [];
      for (const contact of library.digitalContacts) {
        const assembled = projection.digitalContacts.find((row) => row.entity.id === contact.id);
        rows.push(
          previewRow(
            contact.id,
            contact.id,
            'contact',
            `${contact.name} (digital ${contact.digitalId})`,
            contact.name,
            build.contactOverrides,
            assembled ? undefined : PREVIEW_ROW_NOT_REFERENCED_NOTE,
          ),
        );
      }
      for (const contact of library.analogContacts) {
        const assembled = projection.analogContacts.find((row) => row.entity.id === contact.id);
        rows.push(
          previewRow(
            contact.id,
            contact.id,
            'contact',
            `${contact.name} (analog)`,
            contact.name,
            build.contactOverrides,
            assembled ? undefined : PREVIEW_ROW_NOT_REFERENCED_NOTE,
          ),
        );
      }
      return rows;
    }
    case 'rxGroupList':
      return library.rxGroupLists.map((list) => {
        const assembled = projection.rxGroupLists.find((row) => row.entity.id === list.id);
        return previewRow(
          list.id,
          list.id,
          'rxGroupList',
          `${list.name} (${list.members.length} members)`,
          list.name,
          build.rxGroupListOverrides,
          assembled ? undefined : PREVIEW_ROW_NOT_REFERENCED_NOTE,
        );
      });
  }
}

/** Whether a preview row would be included in CPS export (per-row include toggle + export inclusion flags). */
export function isPreviewRowIncludedInExport(
  build: FormatBuild,
  library: LibrarySlice,
  entityKind: WirePreviewEntityKind,
  row: WirePreviewRow,
): boolean {
  if (row.excluded) return false;

  switch (entityKind) {
    case 'channel':
      if (build.exportUnlinkedChannels !== false) {
        const reachable = zoneLinkedChannelIds(build, library);
        if (
          !reachable.has(row.libraryEntityId) &&
          channelInAnyZoneMembership(row.libraryEntityId, library)
        ) {
          return false;
        }
        return true;
      }
      return zoneLinkedChannelIds(build, library).has(row.libraryEntityId);
    case 'talkGroup':
      if (build.exportUnlinkedTalkGroups !== false) return true;
      return row.expansionNote !== PREVIEW_ROW_NOT_REFERENCED_NOTE;
    case 'rxGroupList':
      if (build.exportUnlinkedRxGroupLists !== false) return true;
      return row.expansionNote !== PREVIEW_ROW_NOT_REFERENCED_NOTE;
    case 'contact':
      return row.expansionNote !== PREVIEW_ROW_NOT_REFERENCED_NOTE;
    case 'zone':
      if (row.forceInclude) return true;
      return !row.omitFromExport;
    default:
      return true;
  }
}

/** Rows that would be included in export (not excluded and matching export inclusion flags). */
export function includedPreviewWireRows(
  build: FormatBuild,
  library: LibrarySlice,
  entityKind: WirePreviewEntityKind,
  options?: CpsExportOptions,
): WirePreviewRow[] {
  return previewWireRows(build, library, entityKind, options).filter((row) =>
    isPreviewRowIncludedInExport(build, library, entityKind, row),
  );
}

export function isPreviewRowExcluded(
  build: FormatBuild,
  entityKind: WirePreviewEntityKind,
  libraryEntityId: string,
): boolean {
  const field = overrideFieldForEntityKind(entityKind);
  return isEntityExcluded(build[field], libraryEntityId);
}

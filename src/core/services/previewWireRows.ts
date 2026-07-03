import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  isEntityExcluded,
  overrideByEntityId,
  type OverrideField,
} from '@core/domain/formatBuildOverrides.ts';
import { channelDisplayLabel } from '@core/domain/channelNaming.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import {
  expandAllDm32ChannelsForExport,
} from '@core/import-export/formats/dm32/channelExpansion.ts';
import {
  expandChannelWireRows,
  modeExportNameSuffix,
} from '@core/import-export/channelExpansion/multiMode.ts';
import { applyTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import { assemble, zoneLinkedChannelIds, type LibrarySlice } from './assemble.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Channel, ChannelModeProfileDMR } from '@core/models/library.ts';
import type { DMRTimeSlot, EntityRef } from '@core/models/libraryTypes.ts';

export type WirePreviewEntityKind = 'channel' | 'zone' | 'talkGroup' | 'contact' | 'rxGroupList';

export const PREVIEW_ROW_NOT_REFERENCED_NOTE = 'Not referenced by exported channels';

/** Optional sub-lines under the display name — expansion context for wire naming. */
export interface WirePreviewDisplayLine {
  label: string;
  value: string;
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
}

export function overrideFieldForEntityKind(entityKind: WirePreviewEntityKind): OverrideField {
  switch (entityKind) {
    case 'channel':
      return 'channelOverrides';
    case 'zone':
      return 'zoneOverrides';
    case 'talkGroup':
      return 'talkGroupOverrides';
    case 'contact':
      return 'contactOverrides';
    case 'rxGroupList':
      return 'rxGroupListOverrides';
  }
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

      if (build.formatId === 'dm32') {
        const assembled = projection;
        const dm32Options = {
          ..._options,
          expandModes: false,
          expandRxGroupLists: _options?.expandRxGroupLists ?? true,
          profileId: _options?.profileId ?? build.profileId,
        };
        const expanded = expandAllDm32ChannelsForExport(
          assembled,
          library,
          dm32Options,
          warnings,
        );
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
        return rows;
      }

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
                : undefined,
          });
        }
      }
      return rows;
    }
    case 'zone':
      return library.zones.map((zone) => {
        const assembled = projection.zones.find((row) => row.zoneId === zone.id);
        const memberCount = assembled?.memberChannelIds.length ?? zone.members.length;
        return previewRow(
          zone.id,
          zone.id,
          'zone',
          `${zone.name} (${memberCount} channel${memberCount === 1 ? '' : 's'})`,
          zone.name,
          build.zoneOverrides,
        );
      });
    case 'talkGroup': {
      const reserved = new Set<string>();
      const warnings: string[] = [];
      return library.talkGroups.map((talkGroup) => {
        const assembled = projection.talkGroups.find((row) => row.entity.id === talkGroup.id);
        const referenced = assembled != null;
        const baseWireName = assembled?.wireName ?? talkGroup.name;
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

/** Rows that would be included in export (not excluded and matching export inclusion flags). */
export function includedPreviewWireRows(
  build: FormatBuild,
  library: LibrarySlice,
  entityKind: WirePreviewEntityKind,
  options?: CpsExportOptions,
): WirePreviewRow[] {
  const projection = assemble(build, library, { profileId: options?.profileId });
  const rows = previewWireRows(build, library, entityKind, options).filter((row) => !row.excluded);

  const includeUnlinkedChannels = build.exportUnlinkedChannels !== false;
  const includeUnlinkedTalkGroups = build.exportUnlinkedTalkGroups !== false;
  const includeUnlinkedRxGroupLists = build.exportUnlinkedRxGroupLists !== false;

  switch (entityKind) {
    case 'channel':
      if (includeUnlinkedChannels) return rows;
      {
        const zoneLinked = zoneLinkedChannelIds(build, library);
        return rows.filter((row) => zoneLinked.has(row.libraryEntityId));
      }
    case 'talkGroup':
      if (includeUnlinkedTalkGroups) return rows;
      return rows.filter((row) =>
        projection.talkGroups.some((tg) => tg.entity.id === row.libraryEntityId),
      );
    case 'rxGroupList':
      if (includeUnlinkedRxGroupLists) return rows;
      return rows.filter((row) =>
        projection.rxGroupLists.some((list) => list.entity.id === row.libraryEntityId),
      );
    case 'contact':
      return rows.filter(
        (row) =>
          projection.digitalContacts.some((contact) => contact.entity.id === row.libraryEntityId) ||
          projection.analogContacts.some((contact) => contact.entity.id === row.libraryEntityId),
      );
    default:
      return rows;
  }
}

export function isPreviewRowExcluded(
  build: FormatBuild,
  entityKind: WirePreviewEntityKind,
  libraryEntityId: string,
): boolean {
  const field = overrideFieldForEntityKind(entityKind);
  return isEntityExcluded(build[field], libraryEntityId);
}

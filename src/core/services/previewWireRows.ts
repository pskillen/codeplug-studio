import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  isEntityExcluded,
  overrideByEntityId,
  type OverrideField,
} from '@core/domain/formatBuildOverrides.ts';
import {
  channelDisplayLabel,
} from '@core/domain/channelNaming.ts';
import {
  expandChannelWireRows,
  modeExportNameSuffix,
} from '@core/import-export/channelExpansion/multiMode.ts';
import { assemble, type LibrarySlice } from './assemble.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';

export type WirePreviewEntityKind =
  | 'channel'
  | 'zone'
  | 'talkGroup'
  | 'contact'
  | 'rxGroupList';

export interface WirePreviewRow {
  /** Stable key for override storage — library entity id, or composite for expansion rows. */
  key: string;
  libraryEntityId: string;
  entityKind: WirePreviewEntityKind;
  displayLabel: string;
  generatedWireName: string;
  effectiveWireName: string;
  excluded: boolean;
  expansionNote?: string;
}

export function overrideFieldForEntityKind(
  entityKind: WirePreviewEntityKind,
): OverrideField {
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
): WirePreviewRow {
  const override = overrideByEntityId(overrides).get(libraryEntityId);
  const excluded = override?.excluded === true;
  const effectiveWireName = override?.wireName?.trim() || generatedWireName;
  return {
    key,
    libraryEntityId,
    entityKind,
    displayLabel,
    generatedWireName,
    effectiveWireName,
    excluded,
    expansionNote,
  };
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
      const expandModes = _options?.expandModes ?? true;
      const rows: WirePreviewRow[] = [];
      const reserved = new Set<string>();
      const warnings: string[] = [];
      for (const channel of library.channels) {
        const assembled = projection.channels.find((row) => row.entity.id === channel.id);
        const overrideWireName = overrideByEntityId(build.channelOverrides).get(channel.id)?.wireName;
        const baseWireName = overrideWireName?.trim() || assembled?.wireName;
        const expansions = expandChannelWireRows(
          channel,
          baseWireName,
          expandModes,
          _options,
          build.profileId,
          reserved,
          warnings,
        );
        for (const expanded of expansions) {
          const keyOverride = overrideByEntityId(build.channelOverrides).get(expanded.key)?.wireName?.trim();
          const generatedWireName = expanded.wireName;
          const excluded = isEntityExcluded(build.channelOverrides, channel.id);
          rows.push({
            key: expanded.key,
            libraryEntityId: channel.id,
            entityKind: 'channel',
            displayLabel:
              expansions.length > 1
                ? `${channelDisplayLabel(channel)} (${expanded.mode.toUpperCase()})`
                : channelDisplayLabel(channel),
            generatedWireName,
            effectiveWireName: keyOverride || generatedWireName,
            excluded,
            expansionNote:
              expansions.length > 1
                ? `Multi-mode ${modeExportNameSuffix(expanded.mode)} row`
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
        const generatedWireName = assembled?.wireName ?? zone.name;
        return previewRow(
          zone.id,
          zone.id,
          'zone',
          `${zone.name} (${memberCount} channel${memberCount === 1 ? '' : 's'})`,
          generatedWireName,
          build.zoneOverrides,
        );
      });
    case 'talkGroup':
      return library.talkGroups.map((talkGroup) => {
        const assembled = projection.talkGroups.find((row) => row.entity.id === talkGroup.id);
        const generatedWireName = assembled?.wireName ?? talkGroup.name;
        const referenced = assembled != null;
        return previewRow(
          talkGroup.id,
          talkGroup.id,
          'talkGroup',
          `${talkGroup.name} (ID ${talkGroup.digitalId})`,
          generatedWireName,
          build.talkGroupOverrides,
          referenced ? undefined : 'Not referenced by exported channels',
        );
      });
    case 'contact': {
      const rows: WirePreviewRow[] = [];
      for (const contact of library.digitalContacts) {
        const assembled = projection.digitalContacts.find((row) => row.entity.id === contact.id);
        const generatedWireName = assembled?.wireName ?? contact.name;
        rows.push(
          previewRow(
            contact.id,
            contact.id,
            'contact',
            `${contact.name} (digital ${contact.digitalId})`,
            generatedWireName,
            build.contactOverrides,
            assembled ? undefined : 'Not referenced by exported channels',
          ),
        );
      }
      for (const contact of library.analogContacts) {
        const assembled = projection.analogContacts.find((row) => row.entity.id === contact.id);
        const generatedWireName = assembled?.wireName ?? contact.name;
        rows.push(
          previewRow(
            contact.id,
            contact.id,
            'contact',
            `${contact.name} (analog)`,
            generatedWireName,
            build.contactOverrides,
            assembled ? undefined : 'Not referenced by exported channels',
          ),
        );
      }
      return rows;
    }
    case 'rxGroupList':
      return library.rxGroupLists.map((list) => {
        const assembled = projection.rxGroupLists.find((row) => row.entity.id === list.id);
        const generatedWireName = assembled?.wireName ?? list.name;
        return previewRow(
          list.id,
          list.id,
          'rxGroupList',
          `${list.name} (${list.members.length} members)`,
          generatedWireName,
          build.rxGroupListOverrides,
          assembled ? undefined : 'Not referenced by exported channels',
        );
      });
  }
}

/** Rows that would be included in export (not excluded and, for referenced kinds, in projection). */
export function includedPreviewWireRows(
  build: FormatBuild,
  library: LibrarySlice,
  entityKind: WirePreviewEntityKind,
  options?: CpsExportOptions,
): WirePreviewRow[] {
  return previewWireRows(build, library, entityKind, options).filter((row) => !row.excluded);
}

export function isPreviewRowExcluded(
  build: FormatBuild,
  entityKind: WirePreviewEntityKind,
  libraryEntityId: string,
): boolean {
  const field = overrideFieldForEntityKind(entityKind);
  return isEntityExcluded(build[field], libraryEntityId);
}

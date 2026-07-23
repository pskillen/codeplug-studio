import {
  isEntityExcluded,
  isEntityForceIncluded,
  overrideByEntityId,
  overrideOrderOrSlot,
  type OverrideField,
} from '@core/domain/formatBuildOverrides.ts';
import { channelDisplayLabel, defaultChannelWireName } from '@core/domain/channelNaming.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import {
  expandAllMxNChannels,
  type ExpandedMxNChannelRow,
} from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { anytoneChannelWireName } from '@core/import-export/formats/anytone/exportChannelWire.ts';
import {
  expandChannelWireRows,
  modeExportNameSuffix,
} from '@core/import-export/channelExpansion/multiMode.ts';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
import { applyTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import {
  applyListWireNameLimits,
  formatUsesListNameShortening,
} from '@core/import-export/channelExpansion/listWireNames.ts';
import {
  applyDigitalContactExportWireName,
  resolveAnalogContactExportBaseName,
  resolveDigitalContactExportBaseName,
} from '@core/import-export/digitalContactExportName.ts';
import {
  assemble,
  channelInAnyZoneMembership,
  zoneLinkedChannelIds,
  type LibrarySlice,
} from './assemble.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { Channel, ChannelModeProfileDMR, Zone } from '@core/models/library.ts';
import type { DMRTimeSlot, EntityRef } from '@core/models/libraryTypes.ts';
import { directZoneMemberChannelIds, directZoneMemberZoneIds } from '@core/domain/zoneMembers.ts';
import { sortZonesByExportOrder } from '@core/domain/zoneOrder.ts';
import {
  findZoneGroupingSection,
  isZoneMemberOrderOverridden,
} from '@core/domain/zoneGroupingLayout.ts';
import { isChirpAnalogueExportable } from '@core/import-export/formats/chirp/channelWire.ts';
import {
  previewGeneratedChannelWireName,
  type WirePreviewChannelNameOptions,
} from './previewChannelWireName.ts';
import { defaultCompatibleEgress } from '@core/radio-targets/index.ts';
import { isAmAirbandBankChannel } from '@core/import-export/formats/anytone/receiveOnlyBanks.ts';
import {
  classifyAnytoneZoneByMembers,
  zoneShowsOnAnytoneAirbandBank,
  zoneShowsOnAnytoneDmrBank,
} from '@core/import-export/formats/anytone/zonePartition.ts';

export type WirePreviewEntityKind =
  'channel' | 'zone' | 'scanList' | 'talkGroup' | 'contact' | 'rxGroupList';

export const PREVIEW_ROW_NOT_REFERENCED_NOTE = 'Not referenced by exported channels';

export const PREVIEW_ROW_NOT_ZONE_LINKED_NOTE = 'Not linked to a zone';

export const PREVIEW_ROW_NOT_IN_MEMORY_LIST_NOTE = 'Not in memory list';

export const PREVIEW_ROW_NOT_ANALOGUE_CHIRP_NOTE = 'Not analogue — skipped on CHIRP export';

export const PREVIEW_ROW_OMIT_FROM_EXPORT_NOTE =
  'Not exported as its own zone — channels still export inside parent zones (library setting)';

/** Anytone receive-bank filter for wire preview (DMR vs AM airband). */
export type AnytoneWirePreviewBank = 'dmr' | 'airband';

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
  /** True when the build stores a densified `orderOrSlot` for this row key. */
  hasOrderOrSlotOverride: boolean;
  /**
   * Zones only — true when build layout `channelIds` reorders members relative to
   * library effective membership order.
   */
  hasMemberOrderOverride?: boolean;
  excluded: boolean;
  expansionNote?: string;
  displayDetails?: WirePreviewDisplayLine[];
  /** Library zone flagged omitFromExport — no standalone Zones.csv row. */
  omitFromExport?: boolean;
  /** Per-build override: export standalone zone despite library omitFromExport. */
  forceInclude?: boolean;
  /** Direct library zone members — zones wire preview only. */
  zoneDirectMembers?: WirePreviewZoneDirectMembers;
  /** Digital contact callsign from library — contact wire preview search/column. */
  libraryCallsign?: string;
  /** Channel rows only — frequencies for band pills beside the library name. */
  rxFrequency?: number | null;
  txFrequency?: number | null;
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

/** Band-pill frequencies for channel wire-preview rows. */
function channelBandFields(channel: Channel): Pick<WirePreviewRow, 'rxFrequency' | 'txFrequency'> {
  return {
    rxFrequency: channel.rxFrequency,
    txFrequency: channel.txFrequency,
  };
}

function previewRow(
  key: string,
  libraryEntityId: string,
  entityKind: WirePreviewEntityKind,
  displayLabel: string,
  generatedWireName: string,
  overrides: RadioBuild[OverrideField],
  expansionNote?: string,
  displayDetails?: WirePreviewDisplayLine[],
  libraryCallsign?: string,
): WirePreviewRow {
  const override = overrideByEntityId(overrides).get(key);
  const excluded = override?.excluded === true;
  const wireNameOverride = override?.wireName?.trim();
  const effectiveWireName = sanitiseAsciiWireString(wireNameOverride || generatedWireName);
  const orderOrSlot = override?.orderOrSlot;
  const hasOrderOrSlotOverride =
    orderOrSlot != null && Number.isFinite(orderOrSlot) && orderOrSlot >= 1;
  return {
    key,
    libraryEntityId,
    entityKind,
    displayLabel,
    generatedWireName: sanitiseAsciiWireString(generatedWireName),
    effectiveWireName,
    hasWireNameOverride: Boolean(wireNameOverride),
    hasOrderOrSlotOverride,
    excluded,
    expansionNote,
    displayDetails,
    libraryCallsign,
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

function mxnExpansionDisplayDetails(
  channel: Channel,
  generated: ExpandedMxNChannelRow,
  library: LibrarySlice,
): WirePreviewDisplayLine[] | undefined {
  if (generated.rowKind === 'scratch') {
    return [{ label: 'Row', value: 'Scratch channel' }];
  }
  if (generated.rowKind === 'talkGroup') {
    return dm32RxListFanOutDisplayDetails(channel, generated.txContactRef, library);
  }
  return undefined;
}

export function previewWireRows(
  build: RadioBuild,
  library: LibrarySlice,
  entityKind: WirePreviewEntityKind,
  _options?: WirePreviewChannelNameOptions,
  anytoneBank: AnytoneWirePreviewBank = 'dmr',
): WirePreviewRow[] {
  const defaultEgress = defaultCompatibleEgress(build.radioTargetId);
  const formatId = _options?.formatId ?? defaultEgress?.formatId ?? '';
  const profileId = _options?.profileId ?? defaultEgress?.profileId;
  const projection = assemble(build, library, { formatId, profileId });

  switch (entityKind) {
    case 'channel': {
      // DM-32 CSV and radio-io-dm32uv are zone-grouped; only Mini radio-io is flat memory.
      const expandModes =
        formatId === 'dm32' || profileId === 'radio-io-dm32uv'
          ? false
          : (_options?.expandModes ?? true);
      const rows: WirePreviewRow[] = [];
      const reserved = new Set<string>();
      const warnings: string[] = [];

      if (formatId === 'chirp' || (formatId === 'radio-io' && profileId === 'radio-io-uv5r-mini')) {
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
            hasOrderOrSlotOverride: overrideOrderOrSlot(build.channelOverrides, channel.id) != null,
            excluded: isEntityExcluded(build.channelOverrides, channel.id),
            expansionNote,
            ...channelBandFields(channel),
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

      if (hasMxNChannelExpansion(build.radioTargetId)) {
        const assembled = projection;
        const mxnOptions = {
          ..._options,
          expandModes: false,
          expandRxGroupLists: _options?.expandRxGroupLists ?? true,
          exportScratchChannels: _options?.exportScratchChannels ?? true,
          profileId,
        };
        const expanded = expandAllMxNChannels({
          assembled,
          library,
          radioTargetId: build.radioTargetId,
          options: mxnOptions,
          warnings,
          resolveSiteWireName:
            formatId === 'anytone'
              ? (assembledChannel, ctx) =>
                  anytoneChannelWireName(
                    assembledChannel,
                    {
                      reserved: ctx.reserved,
                      warnings: ctx.warnings,
                      reserve: !ctx.willExpandRx,
                    },
                    ctx.options,
                    ctx.profileId ?? profileId,
                  )
              : undefined,
        });
        const expandedByChannelId = new Map<string, ExpandedMxNChannelRow[]>();
        for (const generated of expanded) {
          const list = expandedByChannelId.get(generated.sourceChannelId) ?? [];
          list.push(generated);
          expandedByChannelId.set(generated.sourceChannelId, list);
        }
        const zoneLinkedForPreview =
          build.exportUnlinkedChannels === false ? zoneLinkedChannelIds(build, library) : null;

        const behaviourContext = _options?.channelBehaviourContext;

        for (const channel of library.channels) {
          if (formatId === 'anytone') {
            if (anytoneBank === 'dmr' && isAmAirbandBankChannel(channel, behaviourContext))
              continue;
            if (anytoneBank === 'airband' && !isAmAirbandBankChannel(channel, behaviourContext))
              continue;
          }
          const generatedRows = expandedByChannelId.get(channel.id);
          if (generatedRows) {
            for (const generated of generatedRows) {
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
                hasOrderOrSlotOverride:
                  overrideOrderOrSlot(build.channelOverrides, channel.id) != null,
                excluded: isEntityExcluded(build.channelOverrides, channel.id),
                expansionNote: generated.expansionNote,
                displayDetails: mxnExpansionDisplayDetails(channel, generated, library),
                ...channelBandFields(channel),
              });
            }
            continue;
          }

          const channelOverride = overrideByEntityId(build.channelOverrides)
            .get(channel.id)
            ?.wireName?.trim();
          const generatedWireName =
            formatId === 'anytone'
              ? previewGeneratedChannelWireName(channel, build, _options)
              : defaultChannelWireName(channel);
          rows.push({
            key: channel.id,
            libraryEntityId: channel.id,
            entityKind: 'channel',
            displayLabel: channelDisplayLabel(channel),
            generatedWireName: sanitiseAsciiWireString(generatedWireName),
            effectiveWireName: sanitiseAsciiWireString(channelOverride ?? generatedWireName),
            hasWireNameOverride: Boolean(channelOverride),
            hasOrderOrSlotOverride: overrideOrderOrSlot(build.channelOverrides, channel.id) != null,
            excluded: isEntityExcluded(build.channelOverrides, channel.id),
            expansionNote:
              zoneLinkedForPreview && !zoneLinkedForPreview.has(channel.id)
                ? PREVIEW_ROW_NOT_ZONE_LINKED_NOTE
                : undefined,
            ...channelBandFields(channel),
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
          profileId,
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
            hasOrderOrSlotOverride: overrideOrderOrSlot(build.channelOverrides, channel.id) != null,
            excluded,
            expansionNote:
              generatedExpansions.length > 1
                ? `Multi-mode ${modeExportNameSuffix(generated.mode)} row`
                : zoneLinkedForPreview && !zoneLinkedForPreview.has(channel.id)
                  ? PREVIEW_ROW_NOT_ZONE_LINKED_NOTE
                  : undefined,
            ...channelBandFields(channel),
          });
        }
      }
      return rows;
    }
    case 'zone': {
      const shortenListNames = formatUsesListNameShortening(formatId);
      const reserved = shortenListNames ? new Set<string>() : null;
      const warnings: string[] = [];
      const channelById = new Map(library.channels.map((ch) => [ch.id, ch]));
      const zonesForBank =
        formatId === 'anytone'
          ? library.zones.filter((zone) => {
              const assembledZone = projection.zones.find((row) => row.zoneId === zone.id);
              const memberIds =
                assembledZone && assembledZone.memberChannelIds.length > 0
                  ? assembledZone.memberChannelIds
                  : directZoneMemberChannelIds(zone);
              const kind = classifyAnytoneZoneByMembers(
                memberIds,
                channelById,
                _options?.channelBehaviourContext,
              );
              return anytoneBank === 'airband'
                ? zoneShowsOnAnytoneAirbandBank(kind)
                : zoneShowsOnAnytoneDmrBank(kind);
            })
          : library.zones;
      const zonesForPreview = sortZonesByExportOrder(zonesForBank, build.zoneOverrides);
      const zoneGrouping = findZoneGroupingSection(build);
      return zonesForPreview.map((zone) => {
        const omitFromExport = zone.omitFromExport === true;
        const forceInclude = isEntityForceIncluded(build.zoneOverrides, zone.id);
        const zoneDirectMembers = zoneDirectMembersPreview(zone, library);
        const assembledZone = projection.zones.find((row) => row.zoneId === zone.id);
        const baseWireName = assembledZone?.wireName ?? zone.name;
        const generatedWireName = shortenListNames
          ? applyListWireNameLimits(baseWireName, reserved!, _options, profileId, warnings)
          : zone.name;
        const layoutEntry = zoneGrouping?.zones.find((entry) => entry.id === zone.id);
        return {
          ...previewRow(
            zone.id,
            zone.id,
            'zone',
            zone.name,
            generatedWireName,
            build.zoneOverrides,
            omitFromExport ? PREVIEW_ROW_OMIT_FROM_EXPORT_NOTE : undefined,
          ),
          omitFromExport,
          forceInclude,
          zoneDirectMembers,
          hasMemberOrderOverride: isZoneMemberOrderOverridden(
            zone,
            library.zones,
            layoutEntry?.channelIds,
          ),
        };
      });
    }
    case 'scanList': {
      const shortenListNames = formatId === 'anytone';
      const reserved = shortenListNames ? new Set<string>() : null;
      const warnings: string[] = [];
      return library.scanLists.map((entry) => {
        const assembled = projection.scanLists.find((row) => row.scanListId === entry.id);
        const memberCount = entry.memberChannelIds.length;
        const baseWireName = assembled?.wireName ?? entry.name;
        const generatedWireName = shortenListNames
          ? applyListWireNameLimits(baseWireName, reserved!, _options, profileId, warnings)
          : entry.name;
        return previewRow(
          entry.id,
          entry.id,
          'scanList',
          `${entry.name} (${memberCount} channels)`,
          generatedWireName,
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
          profileId,
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
      const shortenContacts = formatId === 'anytone' || formatId === 'opengd77';
      const mode = _options?.digitalContactExportNameMode ?? 'name';
      const contactOverrides = _options?.contactOverrides ?? build.contactOverrides;
      const warnings: string[] = [];
      const rows: WirePreviewRow[] = [];
      for (const contact of library.digitalContacts) {
        const assembled = projection.digitalContacts.find((row) => row.entity.id === contact.id);
        const baseWireName = resolveDigitalContactExportBaseName(contact, contactOverrides, mode);
        const generatedWireName = shortenContacts
          ? applyDigitalContactExportWireName(baseWireName, _options, profileId, warnings)
          : contact.name;
        rows.push(
          previewRow(
            contact.id,
            contact.id,
            'contact',
            `${contact.name} (digital ${contact.digitalId})`,
            generatedWireName,
            build.contactOverrides,
            assembled ? undefined : PREVIEW_ROW_NOT_REFERENCED_NOTE,
            undefined,
            contact.callsign,
          ),
        );
      }
      for (const contact of library.analogContacts) {
        const assembled = projection.analogContacts.find((row) => row.entity.id === contact.id);
        const baseWireName = resolveAnalogContactExportBaseName(contact, contactOverrides);
        const generatedWireName = shortenContacts
          ? applyDigitalContactExportWireName(baseWireName, _options, profileId, warnings)
          : contact.name;
        rows.push(
          previewRow(
            contact.id,
            contact.id,
            'contact',
            `${contact.name} (analog)`,
            generatedWireName,
            build.contactOverrides,
            assembled ? undefined : PREVIEW_ROW_NOT_REFERENCED_NOTE,
          ),
        );
      }
      return rows;
    }
    case 'rxGroupList': {
      const shortenListNames = formatUsesListNameShortening(formatId);
      const reserved = shortenListNames ? new Set<string>() : null;
      const warnings: string[] = [];
      return library.rxGroupLists.map((list) => {
        const assembled = projection.rxGroupLists.find((row) => row.entity.id === list.id);
        const baseWireName = assembled?.wireName ?? list.name;
        const generatedWireName = shortenListNames
          ? applyListWireNameLimits(baseWireName, reserved!, _options, profileId, warnings)
          : list.name;
        return previewRow(
          list.id,
          list.id,
          'rxGroupList',
          `${list.name} (${list.members.length} members)`,
          generatedWireName,
          build.rxGroupListOverrides,
          assembled ? undefined : PREVIEW_ROW_NOT_REFERENCED_NOTE,
        );
      });
    }
  }
}

/** Whether a preview row would be included in CPS export (per-row include toggle + export inclusion flags). */
export function isPreviewRowIncludedInExport(
  build: RadioBuild,
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
    case 'contact':
      if (build.exportUnlinkedDigitalContacts !== false) return true;
      return row.expansionNote !== PREVIEW_ROW_NOT_REFERENCED_NOTE;
    case 'rxGroupList':
      if (build.exportUnlinkedRxGroupLists !== false) return true;
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
  build: RadioBuild,
  library: LibrarySlice,
  entityKind: WirePreviewEntityKind,
  options?: WirePreviewChannelNameOptions,
): WirePreviewRow[] {
  return previewWireRows(build, library, entityKind, options).filter((row) =>
    isPreviewRowIncludedInExport(build, library, entityKind, row),
  );
}

export function isPreviewRowExcluded(
  build: RadioBuild,
  entityKind: WirePreviewEntityKind,
  libraryEntityId: string,
): boolean {
  const field = overrideFieldForEntityKind(entityKind);
  return isEntityExcluded(build[field], libraryEntityId);
}

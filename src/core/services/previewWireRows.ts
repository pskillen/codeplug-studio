import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import {
  isEntityExcluded,
  isEntityForceIncluded,
  isProjectionExcluded,
  overrideByEntityId,
  overrideOrderOrSlot,
  type OverrideField,
} from '@core/domain/formatBuildOverrides.ts';
import { channelDisplayLabel, defaultChannelWireName } from '@core/domain/channelNaming.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import {
  expandAllMxNChannels,
  type ExpandAllMxNChannelsArgs,
  type ExpandedMxNChannelRow,
} from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { mxnSiteWireNameResolverForRadioTarget } from '@core/services/anytoneChannelExpansion.ts';
import {
  expandChannelWireRows,
  modeExportNameSuffix,
} from '@core/import-export/channelExpansion/multiMode.ts';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
import {
  buildTalkGroupTimeslotCloneIndex,
  profileHasTalkGroupTimeslotClones,
} from '@core/import-export/channelExpansion/talkGroupTimeslotClones.ts';
import {
  assemble,
  channelInAnyZoneMembership,
  zoneLinkedChannelIds,
  type LibrarySlice,
} from './assemble.ts';
import {
  channelEligibleForRadio,
  resolveChannelEligibilityOptions,
} from '@core/domain/channelEligibility.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { Channel, ChannelModeProfileDMR, Zone } from '@core/models/library.ts';
import type { ChannelMode, DMRTimeSlot, EntityRef } from '@core/models/libraryTypes.ts';
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
import { resolveBuildDefaultEgress } from '@core/radio-targets/index.ts';
import {
  resolveWireNames,
  type WireNameEntityKind,
  type WireNameRemediation,
  type WireNameResolution,
} from './resolveWireNames.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { isAmAirbandBankChannel } from '@core/import-export/formats/anytone/receiveOnlyBanks.ts';
import {
  classifyAnytoneZoneByMembers,
  zoneShowsOnAnytoneAirbandBank,
  zoneShowsOnAnytoneDmrBank,
} from '@core/import-export/formats/anytone/zonePartition.ts';
import { usesAtD890AirbandBankSplit } from './anytoneChannelBanks.ts';

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
  /**
   * What (if anything) `resolveWireNames` had to do to fit the effective name — undefined
   * for expansion rows (m×n / multi-mode / CHIRP flat-memory) that don't join a resolver
   * result. UI may ignore this until the inline-edit rework (phase 6).
   */
  remediation?: WireNameRemediation;
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
  /**
   * Channel rows only — which mode this row represents (m×n / multi-mode expansion rows use
   * the row's own projected mode; single-mode rows use the channel's mode profile). Feeds the
   * wire-preview "Mode" indicator (ux-proposal §2) — no new domain logic, just surfacing data
   * `previewWireRows` already computes per row.
   */
  channelMode?: ChannelMode;
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

function zoneDirectMembersPreview(
  zone: Zone,
  library: LibrarySlice,
  build: RadioBuild,
): WirePreviewZoneDirectMembers {
  const eligibilityOptions = resolveChannelEligibilityOptions(build);
  const channelIds = directZoneMemberChannelIds(zone).filter((id) => {
    const ch = library.channels.find((row) => row.id === id);
    return ch != null && channelEligibleForRadio(ch, build.radioTargetId, eligibilityOptions);
  });
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

/**
 * Build a `WirePreviewRow` from a `resolveWireNames` resolution — the resolver owns the
 * wire-name math (suggestion/effective/override/remediation); this only adds the
 * preview-specific fields (`hasOrderOrSlotOverride`, `excluded`) the resolver doesn't know
 * about.
 */
function previewRow(
  key: string,
  libraryEntityId: string,
  entityKind: WirePreviewEntityKind,
  displayLabel: string,
  resolution: WireNameResolution,
  overrides: RadioBuild[OverrideField],
  expansionNote?: string,
  displayDetails?: WirePreviewDisplayLine[],
  libraryCallsign?: string,
): WirePreviewRow {
  const override = overrideByEntityId(overrides).get(key);
  const excluded = override?.excluded === true;
  const orderOrSlot = override?.orderOrSlot;
  const hasOrderOrSlotOverride =
    orderOrSlot != null && Number.isFinite(orderOrSlot) && orderOrSlot >= 1;
  return {
    key,
    libraryEntityId,
    entityKind,
    displayLabel,
    generatedWireName: sanitiseAsciiWireString(resolution.suggestion),
    effectiveWireName: sanitiseAsciiWireString(resolution.effective),
    hasWireNameOverride: Boolean(resolution.override),
    hasOrderOrSlotOverride,
    excluded,
    expansionNote,
    displayDetails,
    libraryCallsign,
    remediation: resolution.remediation,
  };
}

/**
 * Synthesise a resolution for a library entity `resolveWireNames` skipped (`'not_used'`
 * profile limit — the entity kind has no wire name on this format/profile at all). Preview
 * still lists the row so the operator can see it isn't wire-named on this target; dedupe
 * and shortening don't apply since nothing will be written.
 */
function fallbackResolution(
  entityKind: WireNameEntityKind,
  id: string,
  libraryName: string,
  rawBase: string,
  overrides: RadioBuild[OverrideField],
): WireNameResolution {
  const overrideRaw = overrideByEntityId(overrides).get(id)?.wireName?.trim();
  const suggestion = sanitiseAsciiWireString(rawBase);
  return {
    key: id,
    libraryEntityId: id,
    entityKind,
    libraryName,
    suggestion,
    override: overrideRaw,
    effective: sanitiseAsciiWireString(overrideRaw || rawBase),
    remediation: 'none',
  };
}

/** Resolve wire names for one entity kind and index by `libraryEntityId` for row joins. */
function resolutionsByLibraryEntityId(
  build: RadioBuild,
  library: LibrarySlice,
  entityKind: WireNameEntityKind,
  formatId: string,
  profileId: string | undefined,
): Map<string, WireNameResolution> {
  return new Map(
    resolveWireNames({ build, library, entityKind, formatId, profileId }).map((resolution) => [
      resolution.libraryEntityId,
      resolution,
    ]),
  );
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

/**
 * Preview-only site-name resolver for m×n expansion.
 *
 * Delegates composition to `mxnSiteWireNameResolverForRadioTarget` — gated on
 * `radioTargetId`, matching production Web Serial writes, so every default egress on a
 * D890 build (not only the `anytone` CSV formatId) gets correct `nameModeOverride`
 * composition. See PR: this was previously gated on `formatId === 'anytone'`, which meant
 * the radio-io / Web Serial default egress on Anytone D890 builds silently fell back to
 * `defaultChannelWireName` with zero options and ignored `nameModeOverride` entirely.
 *
 * Still strips this row's own override before composing, so `generatedWireName` stays the
 * pure suggestion (export still prefers overrides) — `previewWireRows` layers
 * key/channel overrides back on top for `effectiveWireName`.
 */
function purePreviewMxNSiteWireName(
  radioTargetId: string,
): NonNullable<ExpandAllMxNChannelsArgs['resolveSiteWireName']> {
  const resolver = mxnSiteWireNameResolverForRadioTarget(radioTargetId);
  if (!resolver) {
    // No radio-target-specific composer (e.g. DM32) — same pure library compose the
    // resolver's own fallback below uses, kept explicit here so preview never falls
    // through to `expandAllMxNChannels`'s internal default, which folds overrides in.
    return (assembledChannel) => defaultChannelWireName(assembledChannel.entity);
  }
  return (assembledChannel, ctx) =>
    resolver(
      {
        ...assembledChannel,
        wireNameOverride: undefined,
        // assemble folds override into wireName — restore pure library compose
        wireName: defaultChannelWireName(assembledChannel.entity),
      },
      ctx,
    );
}

export function previewWireRows(
  build: RadioBuild,
  library: LibrarySlice,
  entityKind: WirePreviewEntityKind,
  anytoneBank: AnytoneWirePreviewBank = 'dmr',
): WirePreviewRow[] {
  const defaultEgress = resolveBuildDefaultEgress(build);
  const formatId = defaultEgress?.formatId ?? '';
  const profileId = defaultEgress?.profileId;
  const atD890AirbandBankSplit = usesAtD890AirbandBankSplit(profileId);
  const projection = assemble(build, library, { formatId, profileId });
  // Same settings resolveWireNames uses internally — kept alongside so expansion helpers
  // that resolveWireNames doesn't cover (m×n, multi-mode, CHIRP flat memory) stay WYSIWYG too.
  const exportOptions = mergeExportOptions(build, formatId, { profileId }, library);
  const channelNameOptions: WirePreviewChannelNameOptions = {
    ...exportOptions,
    formatId,
    profileId,
  };

  switch (entityKind) {
    case 'channel': {
      // DM-32 CSV and radio-io-dm32uv are zone-grouped; only Mini radio-io is flat memory.
      const expandModes =
        formatId === 'dm32' || profileId === 'radio-io-dm32uv'
          ? false
          : (exportOptions.expandModes ?? true);
      const eligibilityOptions = resolveChannelEligibilityOptions(build);
      const channelPassesRfEligibility = (channel: Channel) =>
        channelEligibleForRadio(channel, build.radioTargetId, eligibilityOptions);
      const rows: WirePreviewRow[] = [];
      const reserved = new Set<string>();
      const warnings: ExportWarning[] = [];

      if (
        formatId === 'chirp' ||
        (formatId === 'radio-io' &&
          (profileId === 'radio-io-uv5r-mini' || profileId === 'radio-io-uv21'))
      ) {
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
          const generatedWireName = previewGeneratedChannelWireName(
            channel,
            build,
            channelNameOptions,
          );
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
            channelMode: channel.modeProfiles[0]?.mode,
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
          if (!channelPassesRfEligibility(channel)) continue;
          pushChannelRow(channel, PREVIEW_ROW_NOT_IN_MEMORY_LIST_NOTE);
        }

        return rows;
      }

      if (hasMxNChannelExpansion(build.radioTargetId)) {
        const assembled = projection;
        const mxnOptions = {
          ...exportOptions,
          expandModes: false,
          expandRxGroupLists: exportOptions.expandRxGroupLists ?? true,
          exportScratchChannels: exportOptions.exportScratchChannels ?? true,
          profileId,
        };
        const expanded = expandAllMxNChannels({
          assembled,
          library,
          radioTargetId: build.radioTargetId,
          options: mxnOptions,
          warnings,
          resolveSiteWireName: purePreviewMxNSiteWireName(build.radioTargetId),
        });
        const expandedByChannelId = new Map<string, ExpandedMxNChannelRow[]>();
        for (const generated of expanded) {
          const list = expandedByChannelId.get(generated.sourceChannelId) ?? [];
          list.push(generated);
          expandedByChannelId.set(generated.sourceChannelId, list);
        }
        const zoneLinkedForPreview =
          build.exportUnlinkedChannels === false ? zoneLinkedChannelIds(build, library) : null;
        // Channels the m×n policy didn't expand (no site/carrier match) fall back to the
        // same per-channel resolution the resolver uses for non-mxn radios — WYSIWYG for
        // every format, not just Anytone.
        const channelResolutions = resolutionsByLibraryEntityId(
          build,
          library,
          'channel',
          formatId,
          profileId,
        );

        const behaviourContext = exportOptions.channelBehaviourContext;

        for (const channel of library.channels) {
          if (!channelPassesRfEligibility(channel)) continue;
          if (atD890AirbandBankSplit) {
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
                excluded: isProjectionExcluded(build.channelOverrides, generated.key, channel.id),
                expansionNote: generated.expansionNote,
                displayDetails: mxnExpansionDisplayDetails(channel, generated, library),
                channelMode: generated.mode,
                ...channelBandFields(channel),
              });
            }
            continue;
          }

          const resolution =
            channelResolutions.get(channel.id) ??
            fallbackResolution(
              'channel',
              channel.id,
              channel.name,
              defaultChannelWireName(channel),
              build.channelOverrides,
            );
          rows.push({
            key: channel.id,
            libraryEntityId: channel.id,
            entityKind: 'channel',
            displayLabel: channelDisplayLabel(channel),
            generatedWireName: sanitiseAsciiWireString(resolution.suggestion),
            effectiveWireName: sanitiseAsciiWireString(resolution.effective),
            hasWireNameOverride: Boolean(resolution.override),
            hasOrderOrSlotOverride: overrideOrderOrSlot(build.channelOverrides, channel.id) != null,
            excluded: isEntityExcluded(build.channelOverrides, channel.id),
            expansionNote:
              zoneLinkedForPreview && !zoneLinkedForPreview.has(channel.id)
                ? PREVIEW_ROW_NOT_ZONE_LINKED_NOTE
                : undefined,
            remediation: resolution.remediation,
            channelMode: channel.modeProfiles[0]?.mode,
            ...channelBandFields(channel),
          });
        }
        return rows;
      }

      const zoneLinkedForPreview =
        build.exportUnlinkedChannels === false ? zoneLinkedChannelIds(build, library) : null;

      for (const channel of library.channels) {
        if (!channelPassesRfEligibility(channel)) continue;
        const generatedExpansions = expandChannelWireRows(
          channel,
          undefined,
          expandModes,
          exportOptions,
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
          const excluded = isProjectionExcluded(build.channelOverrides, generated.key, channel.id);
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
            channelMode: generated.mode,
            ...channelBandFields(channel),
          });
        }
      }
      return rows;
    }
    case 'zone': {
      const resolutions = resolutionsByLibraryEntityId(build, library, 'zone', formatId, profileId);
      const channelById = new Map(library.channels.map((ch) => [ch.id, ch]));
      const zonesForBank = atD890AirbandBankSplit
        ? library.zones.filter((zone) => {
            const assembledZone = projection.zones.find((row) => row.zoneId === zone.id);
            const memberIds =
              assembledZone && assembledZone.memberChannelIds.length > 0
                ? assembledZone.memberChannelIds
                : directZoneMemberChannelIds(zone);
            const kind = classifyAnytoneZoneByMembers(
              memberIds,
              channelById,
              exportOptions.channelBehaviourContext,
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
        const zoneDirectMembers = zoneDirectMembersPreview(zone, library, build);
        const resolution =
          resolutions.get(zone.id) ??
          fallbackResolution('zone', zone.id, zone.name, zone.name, build.zoneOverrides);
        const layoutEntry = zoneGrouping?.zones.find((entry) => entry.id === zone.id);
        return {
          ...previewRow(
            zone.id,
            zone.id,
            'zone',
            zone.name,
            resolution,
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
      const resolutions = resolutionsByLibraryEntityId(
        build,
        library,
        'scanList',
        formatId,
        profileId,
      );
      return library.scanLists.map((entry) => {
        const assembled = projection.scanLists.find((row) => row.scanListId === entry.id);
        const memberCount = entry.memberChannelIds.length;
        const resolution =
          resolutions.get(entry.id) ??
          fallbackResolution('scanList', entry.id, entry.name, entry.name, build.scanListOverrides);
        return previewRow(
          entry.id,
          entry.id,
          'scanList',
          `${entry.name} (${memberCount} channels)`,
          resolution,
          build.scanListOverrides,
          assembled && memberCount > 0 ? undefined : 'No channels in scan list',
        );
      });
    }
    case 'talkGroup': {
      const resolutions = resolutionsByLibraryEntityId(
        build,
        library,
        'talkGroup',
        formatId,
        profileId,
      );
      return library.talkGroups.map((talkGroup) => {
        const assembled = projection.talkGroups.find((row) => row.entity.id === talkGroup.id);
        const referenced = assembled != null;
        const resolution =
          resolutions.get(talkGroup.id) ??
          fallbackResolution(
            'talkGroup',
            talkGroup.id,
            talkGroup.name,
            talkGroup.name,
            build.talkGroupOverrides,
          );
        const cloneDetails =
          profileHasTalkGroupTimeslotClones(profileId) && referenced
            ? buildTalkGroupTimeslotCloneIndex(
                projection,
                new Map([[talkGroup.id, resolution.suggestion]]),
              )
                .clones.filter((clone) => clone.talkGroupId === talkGroup.id)
                .map((clone) => ({
                  label: `TS${clone.slot} contact`,
                  value: clone.wireName,
                }))
            : undefined;
        return previewRow(
          talkGroup.id,
          talkGroup.id,
          'talkGroup',
          `${talkGroup.name} (ID ${talkGroup.digitalId})`,
          resolution,
          build.talkGroupOverrides,
          referenced ? undefined : PREVIEW_ROW_NOT_REFERENCED_NOTE,
          cloneDetails?.length ? cloneDetails : undefined,
        );
      });
    }
    case 'contact': {
      const resolutions = resolutionsByLibraryEntityId(
        build,
        library,
        'contact',
        formatId,
        profileId,
      );
      const rows: WirePreviewRow[] = [];
      for (const contact of library.digitalContacts) {
        const assembled = projection.digitalContacts.find((row) => row.entity.id === contact.id);
        const resolution =
          resolutions.get(contact.id) ??
          fallbackResolution(
            'contact',
            contact.id,
            contact.name,
            contact.name,
            build.contactOverrides,
          );
        rows.push(
          previewRow(
            contact.id,
            contact.id,
            'contact',
            `${contact.name} (digital ${contact.digitalId})`,
            resolution,
            build.contactOverrides,
            assembled ? undefined : PREVIEW_ROW_NOT_REFERENCED_NOTE,
            undefined,
            contact.callsign,
          ),
        );
      }
      for (const contact of library.analogContacts) {
        const assembled = projection.analogContacts.find((row) => row.entity.id === contact.id);
        const resolution =
          resolutions.get(contact.id) ??
          fallbackResolution(
            'contact',
            contact.id,
            contact.name,
            contact.name,
            build.contactOverrides,
          );
        rows.push(
          previewRow(
            contact.id,
            contact.id,
            'contact',
            `${contact.name} (analog)`,
            resolution,
            build.contactOverrides,
            assembled ? undefined : PREVIEW_ROW_NOT_REFERENCED_NOTE,
          ),
        );
      }
      return rows;
    }
    case 'rxGroupList': {
      const resolutions = resolutionsByLibraryEntityId(
        build,
        library,
        'rxGroupList',
        formatId,
        profileId,
      );
      return library.rxGroupLists.map((list) => {
        const assembled = projection.rxGroupLists.find((row) => row.entity.id === list.id);
        const resolution =
          resolutions.get(list.id) ??
          fallbackResolution(
            'rxGroupList',
            list.id,
            list.name,
            list.name,
            build.rxGroupListOverrides,
          );
        return previewRow(
          list.id,
          list.id,
          'rxGroupList',
          `${list.name} (${list.members.length} members)`,
          resolution,
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
  anytoneBank: AnytoneWirePreviewBank = 'dmr',
): WirePreviewRow[] {
  return previewWireRows(build, library, entityKind, anytoneBank).filter((row) =>
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

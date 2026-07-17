import type { BuildEntityOverride, FormatBuild } from '@core/models/formatBuild.ts';
import type {
  AnalogContact,
  Channel,
  DigitalContact,
  RxGroupList,
  ScanList,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { ZoneGroupingLayout, ScanListsLayout } from '@core/models/traitLayout.ts';
import {
  isEntityExcluded,
  isEntityForceIncluded,
  overrideByEntityId,
  overrideOrderOrSlot,
  resolveOverrideWireName,
} from '@core/domain/formatBuildOverrides.ts';
import { defaultChannelWireName } from '@core/domain/channelNaming.ts';
import { channelInAnyZoneMembership } from '@core/domain/zoneMembership.ts';
import {
  resolveEffectiveZoneChannelIds,
  collectZoneFlattenWarnings,
} from '@core/domain/zoneHierarchy.ts';
import { orderChannelIdsByLayoutHint } from '@core/domain/zoneGroupingLayout.ts';
import {
  buildUsesFlatMemoryList,
  chirpMemoryChannelIds,
  migrateFlatMemoryLayoutToOrderOrSlot,
  resolveChirpChannelMemorySlots,
  type ExportMemorySlot,
} from '@core/domain/exportOrderOrSlot.ts';
import { migrateFormatBuild } from '@core/domain/migrateFormatBuild.ts';
import { sortZonesByExportOrder } from '@core/domain/zoneOrder.ts';
import type { Library } from '@core/models/library.ts';
import type { AprsConfiguration } from '@core/models/aprs.ts';
import type { ChannelBehaviourDefaults } from '@core/models/channelBehaviourDefaults.ts';
import type { ZoneBehaviourDefaults } from '@core/models/zoneBehaviourDefaults.ts';

/** Library entities needed for export projection — vendor-neutral slice. */
export interface LibrarySlice {
  channels: Channel[];
  zones: Zone[];
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  analogContacts: AnalogContact[];
  rxGroupLists: RxGroupList[];
  scanLists: ScanList[];
  aprsConfiguration?: AprsConfiguration | null;
  channelDefaults?: ChannelBehaviourDefaults;
  zoneDefaults?: ZoneBehaviourDefaults;
}

export function librarySliceFrom(library: Library): LibrarySlice {
  return {
    channels: library.channels,
    zones: library.zones,
    talkGroups: library.talkGroups,
    digitalContacts: library.digitalContacts,
    analogContacts: library.analogContacts,
    rxGroupLists: library.rxGroupLists,
    scanLists: library.scanLists,
    aprsConfiguration: library.aprsConfiguration,
    channelDefaults: library.channelDefaults,
    zoneDefaults: library.zoneDefaults,
  };
}

export interface AssembledEntity<T> {
  entity: T;
  wireName: string;
}

export interface AssembledChannel {
  entity: Channel;
  wireName: string;
  /** Set when the build has an explicit channel wire name override. */
  wireNameOverride?: string;
  /** CPS scan list wire name from `Channel.scanListId` — `None` when unset. */
  scanListWireName?: string;
  /** 1-based CPS slot (`No.` column) when build override sets orderOrSlot. */
  orderOrSlot?: number;
}

export interface AssembledScanList {
  scanListId: string;
  wireName: string;
  memberChannelIds: string[];
}

export interface AssembledZone {
  zoneId: string;
  wireName: string;
  /** Ordered channel ids — wire names resolved at serialise/expansion time. */
  memberChannelIds: string[];
}

/** Export projection from library + format build before wire serialisation. */
export interface AssembledBuild {
  buildId: string;
  formatId: string;
  profileId: string;
  buildName: string;
  channels: AssembledChannel[];
  zones: AssembledZone[];
  scanLists: AssembledScanList[];
  talkGroups: AssembledEntity<TalkGroup>[];
  digitalContacts: AssembledEntity<DigitalContact>[];
  analogContacts: AssembledEntity<AnalogContact>[];
  rxGroupLists: AssembledEntity<RxGroupList>[];
  /** Set by exportBuild for adapters that need raw library access (e.g. DM32 RX expansion). */
  library?: LibrarySlice;
  /** Zone grouping layout section when build has one — used for DM32 scan/scratch export. */
  zoneGrouping?: ZoneGroupingLayout;
  /** Dedicated scan lists layout when build has one — Anytone ScanList.CSV. */
  scanListsLayout?: ScanListsLayout;
  /** CHIRP flat-memory slots (blank slots have `channelId: null`). */
  channelMemorySlots?: ExportMemorySlot[];
  /** Resolved active APRS config for the single global row; null when none selected. */
  aprsConfiguration?: AprsConfiguration | null;
}

export interface AssembleOptions {
  /** Export-time profile override — defaults to `build.profileId`. */
  profileId?: string;
}

function zoneMap(library: LibrarySlice): Map<string, Zone> {
  return new Map(library.zones.map((z) => [z.id, z]));
}

function collectReferencedIds(channels: Channel[]): {
  talkGroupIds: Set<string>;
  digitalContactIds: Set<string>;
  analogContactIds: Set<string>;
  rxGroupListIds: Set<string>;
} {
  const talkGroupIds = new Set<string>();
  const digitalContactIds = new Set<string>();
  const analogContactIds = new Set<string>();
  const rxGroupListIds = new Set<string>();

  for (const channel of channels) {
    for (const profile of channel.modeProfiles) {
      if (profile.mode === 'dmr') {
        if (profile.contactRef?.kind === 'digitalContact') {
          digitalContactIds.add(profile.contactRef.id);
        }
        if (profile.contactRef?.kind === 'analogContact') {
          analogContactIds.add(profile.contactRef.id);
        }
        if (profile.contactRef?.kind === 'talkGroup') {
          talkGroupIds.add(profile.contactRef.id);
        }
        if (profile.rxGroupListId) {
          rxGroupListIds.add(profile.rxGroupListId);
        }
      }
      if (profile.mode === 'nxdn' || profile.mode === 'tetra') {
        if (profile.talkGroupRef?.kind === 'talkGroup') {
          talkGroupIds.add(profile.talkGroupRef.id);
        }
      }
    }
  }

  return { talkGroupIds, digitalContactIds, analogContactIds, rxGroupListIds };
}

function expandRefsFromRxLists(
  library: LibrarySlice,
  rxGroupListIds: Set<string>,
  talkGroupIds: Set<string>,
  digitalContactIds: Set<string>,
  analogContactIds: Set<string>,
): void {
  for (const listId of rxGroupListIds) {
    const list = library.rxGroupLists.find((r) => r.id === listId);
    if (!list) continue;
    for (const member of list.members) {
      switch (member.ref.kind) {
        case 'talkGroup':
          talkGroupIds.add(member.ref.id);
          break;
        case 'digitalContact':
          digitalContactIds.add(member.ref.id);
          break;
        case 'analogContact':
          analogContactIds.add(member.ref.id);
          break;
        default:
          break;
      }
    }
  }
}

function zoneGroupingSections(build: FormatBuild): ZoneGroupingLayout[] {
  return build.layout.sections.filter((s): s is ZoneGroupingLayout => s.kind === 'zoneGrouping');
}

function scanListsSections(build: FormatBuild): ScanListsLayout[] {
  return build.layout.sections.filter((s): s is ScanListsLayout => s.kind === 'scanLists');
}

function resolveChannelScanListWireName(
  channel: { scanListId?: string | null },
  scanListById: Map<string, AssembledScanList>,
): string {
  const scanListId = channel.scanListId?.trim();
  if (!scanListId) return 'None';
  return scanListById.get(scanListId)?.wireName ?? 'None';
}

function assembleScanLists(
  build: FormatBuild,
  library: LibrarySlice,
  exportedChannelIds: Set<string>,
): AssembledScanList[] {
  const layoutEntries = scanListsSections(build).flatMap((section) => section.scanLists);
  const sources =
    library.scanLists.length > 0
      ? library.scanLists.map((list) => ({
          id: list.id,
          name: list.name,
          channelIds: list.memberChannelIds,
        }))
      : layoutEntries;

  if (sources.length === 0) return [];

  const overrides = build.scanListOverrides ?? [];
  const assembled: AssembledScanList[] = [];

  for (const entry of sources) {
    if (isEntityExcluded(overrides, entry.id)) continue;
    const memberChannelIds = entry.channelIds.filter((id) => exportedChannelIds.has(id));
    if (memberChannelIds.length === 0 && !overrideByEntityId(overrides).has(entry.id)) {
      continue;
    }
    assembled.push({
      scanListId: entry.id,
      wireName: resolveOverrideWireName(overrides, entry.id, entry.name),
      memberChannelIds,
    });
  }

  return assembled;
}

export { channelInAnyZoneMembership } from '@core/domain/zoneMembership.ts';

/** Channel ids that appear in at least one exporting standalone zone (nested flatten included). */
export function exportReachableChannelIds(build: FormatBuild, library: LibrarySlice): Set<string> {
  if (buildUsesFlatMemoryList(build)) {
    return new Set(chirpMemoryChannelIds(build, library));
  }

  const zonesById = zoneMap(library);
  const overrides = build.zoneOverrides;
  const ids = new Set<string>();
  const sections = zoneGroupingSections(build);

  const addFromZone = (zone: Zone) => {
    for (const channelId of resolveEffectiveZoneChannelIds(zone, library.zones)) {
      ids.add(channelId);
    }
  };

  if (sections.length > 0) {
    for (const section of sections) {
      for (const zoneEntry of section.zones) {
        if (isEntityExcluded(overrides, zoneEntry.id)) continue;
        const libraryZone = zonesById.get(zoneEntry.id);
        if (libraryZone && zoneExportsStandalone(libraryZone, overrides)) addFromZone(libraryZone);
      }
    }
  } else {
    for (const zone of library.zones) {
      if (isEntityExcluded(overrides, zone.id)) continue;
      if (zoneExportsStandalone(zone, overrides)) addFromZone(zone);
    }
  }

  return ids;
}

/** Channel ids linked via build zone layout and/or library zone membership. */
export function zoneLinkedChannelIds(build: FormatBuild, library: LibrarySlice): Set<string> {
  return exportReachableChannelIds(build, library);
}

function withExportInclusionDefaults(build: FormatBuild): FormatBuild {
  return {
    ...build,
    exportUnlinkedChannels: build.exportUnlinkedChannels ?? true,
    exportUnlinkedTalkGroups: build.exportUnlinkedTalkGroups ?? true,
    exportUnlinkedRxGroupLists: build.exportUnlinkedRxGroupLists ?? true,
    exportUnlinkedDigitalContacts: build.exportUnlinkedDigitalContacts ?? true,
    exportUnlinkedAnalogContacts: build.exportUnlinkedAnalogContacts ?? true,
  };
}

function assembleChannels(build: FormatBuild, library: LibrarySlice): AssembledChannel[] {
  const overrides = build.channelOverrides;
  const includeUnlinked = build.exportUnlinkedChannels !== false;
  const exportReachable = exportReachableChannelIds(build, library);
  const assembled: AssembledChannel[] = [];
  for (const entity of library.channels) {
    if (isEntityExcluded(overrides, entity.id)) continue;
    const hasOverride = overrideByEntityId(overrides).has(entity.id);
    const reachable = exportReachable.has(entity.id);
    if (!reachable && !hasOverride) {
      if (!includeUnlinked || channelInAnyZoneMembership(entity.id, library)) continue;
    }
    const wireNameOverride = overrideByEntityId(overrides).get(entity.id)?.wireName?.trim();
    const generated = defaultChannelWireName(entity);
    assembled.push({
      entity,
      wireName: wireNameOverride ?? generated,
      wireNameOverride,
    });
  }
  return assembled;
}

function zoneExportsStandalone(zone: Zone, overrides: BuildEntityOverride[]): boolean {
  if (isEntityForceIncluded(overrides, zone.id)) return true;
  return zone.omitFromExport !== true;
}

function assembleZones(
  build: FormatBuild,
  library: LibrarySlice,
  exportedChannelIds: Set<string>,
): AssembledZone[] {
  const overrides = build.zoneOverrides;
  const sections = zoneGroupingSections(build);
  const layoutEntryById = new Map(
    sections.flatMap((section) => section.zones.map((entry) => [entry.id, entry] as const)),
  );

  const candidates = sortZonesByExportOrder(
    library.zones.filter(
      (zone) => !isEntityExcluded(overrides, zone.id) && zoneExportsStandalone(zone, overrides),
    ),
    overrides,
  );

  const assembled: AssembledZone[] = [];
  for (const libraryZone of candidates) {
    const layoutEntry = layoutEntryById.get(libraryZone.id);
    const effectiveIds = resolveEffectiveZoneChannelIds(libraryZone, library.zones);
    const memberChannelIds = (
      layoutEntry
        ? orderChannelIdsByLayoutHint(effectiveIds, layoutEntry.channelIds)
        : effectiveIds
    ).filter((id) => exportedChannelIds.has(id));
    if (memberChannelIds.length === 0 && !overrideByEntityId(overrides).has(libraryZone.id)) {
      continue;
    }
    assembled.push({
      zoneId: libraryZone.id,
      wireName: resolveOverrideWireName(overrides, libraryZone.id, libraryZone.name),
      memberChannelIds,
    });
  }
  return assembled;
}

function assembleEntityList<T extends { id: string; name: string }>(
  overrides: BuildEntityOverride[],
  libraryEntities: T[],
  candidateIds: Set<string>,
  includeUnlinkedLibrary: boolean,
): AssembledEntity<T>[] {
  const byId = new Map(libraryEntities.map((entity) => [entity.id, entity]));
  const overrideMap = overrideByEntityId(overrides);
  const ids = new Set(candidateIds);
  if (includeUnlinkedLibrary) {
    for (const entity of libraryEntities) {
      ids.add(entity.id);
    }
  }
  for (const row of overrides) {
    ids.add(row.libraryEntityId);
  }

  const assembled: AssembledEntity<T>[] = [];
  for (const entityId of ids) {
    if (isEntityExcluded(overrides, entityId)) continue;
    const entity = byId.get(entityId);
    if (!entity) continue;
    const referenced = candidateIds.has(entityId);
    const hasOverride = overrideMap.has(entityId);
    if (!referenced && !hasOverride && !includeUnlinkedLibrary) continue;
    assembled.push({
      entity,
      wireName: resolveOverrideWireName(overrides, entity.id, entity.name),
    });
  }
  return assembled;
}

function resolveAprsConfiguration(library: LibrarySlice): AprsConfiguration | null {
  return library.aprsConfiguration ?? null;
}

export function aprsConfigurationWarnings(
  _build: FormatBuild,
  library: LibrarySlice,
  assembled: AssembledBuild,
): string[] {
  const warnings: string[] = [];
  const hasDigitalAprsChannel = library.channels.some(
    (channel) => channel.aprs?.reportType === 'digital',
  );
  if (hasDigitalAprsChannel && !assembled.aprsConfiguration) {
    warnings.push(
      'One or more channels have digital APRS reporting but no APRS configuration exists in the library',
    );
  }
  return warnings;
}

/** Warnings when orphan library entities are included in export. */
export function exportInclusionWarnings(
  build: FormatBuild,
  library: LibrarySlice,
  assembled: AssembledBuild,
): string[] {
  const warnings: string[] = [];
  const normalized = withExportInclusionDefaults(build);

  if (normalized.exportUnlinkedChannels !== false) {
    if (buildUsesFlatMemoryList(normalized)) {
      const memoryIds = new Set(chirpMemoryChannelIds(normalized, library));
      const orphanCount = assembled.channels.filter((row) => !memoryIds.has(row.entity.id)).length;
      if (orphanCount > 0) {
        warnings.push(`Including ${orphanCount} channel(s) not in memory list`);
      }
    } else {
      const zoneLinked = zoneLinkedChannelIds(normalized, library);
      const orphanCount = assembled.channels.filter((row) => !zoneLinked.has(row.entity.id)).length;
      if (orphanCount > 0) {
        warnings.push(`Including ${orphanCount} channel(s) not linked to a zone`);
      }
    }
  }

  const channelEntities = assembled.channels.map((row) => row.entity);
  const refs = collectReferencedIds(channelEntities);
  expandRefsFromRxLists(
    library,
    refs.rxGroupListIds,
    refs.talkGroupIds,
    refs.digitalContactIds,
    refs.analogContactIds,
  );

  if (normalized.exportUnlinkedTalkGroups !== false) {
    const orphanTgCount = assembled.talkGroups.filter(
      (row) => !refs.talkGroupIds.has(row.entity.id),
    ).length;
    if (orphanTgCount > 0) {
      warnings.push(`Including ${orphanTgCount} talk group(s) not referenced by a channel`);
    }
  }

  if (normalized.exportUnlinkedRxGroupLists !== false) {
    const orphanListCount = assembled.rxGroupLists.filter(
      (row) => !refs.rxGroupListIds.has(row.entity.id),
    ).length;
    if (orphanListCount > 0) {
      warnings.push(`Including ${orphanListCount} RX group list(s) not referenced by a channel`);
    }
  }

  if (normalized.exportUnlinkedDigitalContacts !== false) {
    const orphanContactCount = assembled.digitalContacts.filter(
      (row) => !refs.digitalContactIds.has(row.entity.id),
    ).length;
    if (orphanContactCount > 0) {
      warnings.push(
        `Including ${orphanContactCount} digital contact(s) not referenced by a channel`,
      );
    }
  }

  if (normalized.exportUnlinkedAnalogContacts !== false) {
    const orphanContactCount = assembled.analogContacts.filter(
      (row) => !refs.analogContactIds.has(row.entity.id),
    ).length;
    if (orphanContactCount > 0) {
      warnings.push(
        `Including ${orphanContactCount} analog contact(s) not referenced by a channel`,
      );
    }
  }

  warnings.push(
    ...collectZoneFlattenWarnings(
      library.zones,
      assembled.zones.map((zone) => zone.zoneId),
    ),
  );

  warnings.push(...aprsConfigurationWarnings(build, library, assembled));

  return warnings;
}

/**
 * Combine library entities with build overrides and trait layout into an
 * export projection. Wire adapters serialise from this object — not raw rows.
 */
export function assemble(
  build: FormatBuild,
  library: LibrarySlice,
  options?: AssembleOptions,
): AssembledBuild {
  const migratedBase = migrateFormatBuild(build, library as Library);
  const migratedBuild = buildUsesFlatMemoryList(migratedBase)
    ? migrateFlatMemoryLayoutToOrderOrSlot(migratedBase, library)
    : migratedBase;
  const normalizedBuild = withExportInclusionDefaults(migratedBuild);
  const channels = assembleChannels(normalizedBuild, library);
  const exportedChannelIds = new Set(channels.map((c) => c.entity.id));
  const zones = assembleZones(normalizedBuild, library, exportedChannelIds);
  const scanLists = assembleScanLists(normalizedBuild, library, exportedChannelIds);
  const scanListById = new Map(scanLists.map((list) => [list.scanListId, list]));
  const channelsWithScanLists = channels.map((row) => ({
    ...row,
    scanListWireName: resolveChannelScanListWireName(row.entity, scanListById),
    orderOrSlot: overrideOrderOrSlot(normalizedBuild.channelOverrides, row.entity.id),
  }));

  const refs = collectReferencedIds(channelsWithScanLists.map((c) => c.entity));
  expandRefsFromRxLists(
    library,
    refs.rxGroupListIds,
    refs.talkGroupIds,
    refs.digitalContactIds,
    refs.analogContactIds,
  );

  for (const zone of zones) {
    for (const channelId of zone.memberChannelIds) {
      exportedChannelIds.add(channelId);
    }
  }

  const digitalContactIds = new Set(refs.digitalContactIds);
  const analogContactIds = new Set(refs.analogContactIds);
  for (const row of normalizedBuild.contactOverrides) {
    if (library.digitalContacts.some((contact) => contact.id === row.libraryEntityId)) {
      digitalContactIds.add(row.libraryEntityId);
    }
    if (library.analogContacts.some((contact) => contact.id === row.libraryEntityId)) {
      analogContactIds.add(row.libraryEntityId);
    }
  }

  return {
    buildId: normalizedBuild.id,
    formatId: normalizedBuild.formatId,
    profileId: options?.profileId ?? normalizedBuild.profileId,
    buildName: normalizedBuild.name,
    channels: channelsWithScanLists,
    zones,
    scanLists,
    talkGroups: assembleEntityList(
      normalizedBuild.talkGroupOverrides,
      library.talkGroups,
      refs.talkGroupIds,
      normalizedBuild.exportUnlinkedTalkGroups !== false,
    ),
    digitalContacts: assembleEntityList(
      normalizedBuild.contactOverrides,
      library.digitalContacts,
      digitalContactIds,
      normalizedBuild.exportUnlinkedDigitalContacts !== false,
    ),
    analogContacts: assembleEntityList(
      normalizedBuild.contactOverrides,
      library.analogContacts,
      analogContactIds,
      normalizedBuild.exportUnlinkedAnalogContacts !== false,
    ),
    rxGroupLists: assembleEntityList(
      normalizedBuild.rxGroupListOverrides,
      library.rxGroupLists,
      refs.rxGroupListIds,
      normalizedBuild.exportUnlinkedRxGroupLists !== false,
    ),
    channelMemorySlots: buildUsesFlatMemoryList(normalizedBuild)
      ? resolveChirpChannelMemorySlots(normalizedBuild, library)
      : undefined,
    zoneGrouping: zoneGroupingSections(normalizedBuild)[0],
    scanListsLayout: scanListsSections(normalizedBuild)[0],
    aprsConfiguration: resolveAprsConfiguration(library),
  };
}

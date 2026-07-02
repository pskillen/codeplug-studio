import type {
  AnalogContact,
  Channel,
  DigitalContact,
  RxGroupList,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { ZoneGroupingLayout } from '@core/models/traitLayout.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';

/** Library entities needed for export projection — vendor-neutral slice. */
export interface LibrarySlice {
  channels: Channel[];
  zones: Zone[];
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  analogContacts: AnalogContact[];
  rxGroupLists: RxGroupList[];
}

export interface AssembledEntity<T> {
  entity: T;
  wireName: string;
}

export interface AssembledChannel {
  entity: Channel;
  wireName: string;
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
  talkGroups: AssembledEntity<TalkGroup>[];
  digitalContacts: AssembledEntity<DigitalContact>[];
  analogContacts: AssembledEntity<AnalogContact>[];
  rxGroupLists: AssembledEntity<RxGroupList>[];
}

export interface AssembleOptions {
  /** Export-time profile override — defaults to `build.profileId`. */
  profileId?: string;
}

function selectionWireName(
  selections: Array<{ libraryEntityId: string; overrides: { name: string } }>,
  entityId: string,
  fallback: string,
): string {
  const sel = selections.find((s) => s.libraryEntityId === entityId);
  const name = sel?.overrides.name?.trim();
  return name || fallback;
}

function channelMap(library: LibrarySlice): Map<string, Channel> {
  return new Map(library.channels.map((c) => [c.id, c]));
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

function assembleChannels(build: FormatBuild, library: LibrarySlice): AssembledChannel[] {
  const byId = channelMap(library);
  const selectionIds = build.channelSelections.map((s) => s.libraryEntityId);
  const ids =
    selectionIds.length > 0 ? selectionIds : library.channels.map((c) => c.id);

  const assembled: AssembledChannel[] = [];
  for (const id of ids) {
    const entity = byId.get(id);
    if (!entity) continue;
    assembled.push({
      entity,
      wireName: selectionWireName(build.channelSelections, id, entity.name),
    });
  }
  return assembled;
}

function zoneGroupingSections(build: FormatBuild): ZoneGroupingLayout[] {
  return build.layout.sections.filter((s): s is ZoneGroupingLayout => s.kind === 'zoneGrouping');
}

function assembleZones(
  build: FormatBuild,
  library: LibrarySlice,
  exportedChannelIds: Set<string>,
): AssembledZone[] {
  const zonesById = zoneMap(library);
  const sections = zoneGroupingSections(build);

  if (sections.length > 0) {
    const assembled: AssembledZone[] = [];
    for (const section of sections) {
      for (const zoneEntry of section.zones) {
        const libraryZone = zonesById.get(zoneEntry.id);
        const fallbackName = libraryZone?.name ?? zoneEntry.name;
        const memberChannelIds = zoneEntry.channelIds.filter((id) => exportedChannelIds.has(id));
        if (memberChannelIds.length === 0 && !build.zoneSelections.some((z) => z.libraryEntityId === zoneEntry.id)) {
          continue;
        }
        assembled.push({
          zoneId: zoneEntry.id,
          wireName: selectionWireName(build.zoneSelections, zoneEntry.id, fallbackName),
          memberChannelIds,
        });
      }
    }
    return assembled;
  }

  const zoneSelectionIds = new Set(build.zoneSelections.map((z) => z.libraryEntityId));
  const zones =
    zoneSelectionIds.size > 0
      ? library.zones.filter((z) => zoneSelectionIds.has(z.id))
      : library.zones;

  return zones
    .map((zone) => {
      const memberChannelIds = zone.members
        .filter((m: EntityRef) => m.kind === 'channel' && exportedChannelIds.has(m.id))
        .map((m) => m.id);
      return {
        zoneId: zone.id,
        wireName: selectionWireName(build.zoneSelections, zone.id, zone.name),
        memberChannelIds,
      };
    })
    .filter((z) => z.memberChannelIds.length > 0 || build.zoneSelections.some((s) => s.libraryEntityId === z.zoneId));
}

function assembleEntityList<T extends { id: string; name: string }>(
  buildSelections: Array<{ libraryEntityId: string; overrides: { name: string } }>,
  libraryEntities: T[],
  referencedIds: Set<string>,
): AssembledEntity<T>[] {
  if (buildSelections.length > 0) {
    const byId = new Map(libraryEntities.map((e) => [e.id, e]));
    return buildSelections
      .map((sel) => {
        const entity = byId.get(sel.libraryEntityId);
        if (!entity) return null;
        return {
          entity,
          wireName: selectionWireName(buildSelections, entity.id, entity.name),
        };
      })
      .filter((row): row is AssembledEntity<T> => row !== null);
  }

  return libraryEntities
    .filter((e) => referencedIds.has(e.id))
    .map((entity) => ({
      entity,
      wireName: entity.name,
    }));
}

/**
 * Combine library entities with build selections and trait layout into an
 * export projection. Wire adapters serialise from this object — not raw rows.
 */
export function assemble(
  build: FormatBuild,
  library: LibrarySlice,
  options?: AssembleOptions,
): AssembledBuild {
  const channels = assembleChannels(build, library);
  const exportedChannelIds = new Set(channels.map((c) => c.entity.id));
  const zones = assembleZones(build, library, exportedChannelIds);

  const refs = collectReferencedIds(channels.map((c) => c.entity));
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

  return {
    buildId: build.id,
    formatId: build.formatId,
    profileId: options?.profileId ?? build.profileId,
    buildName: build.name,
    channels,
    zones,
    talkGroups: assembleEntityList(build.talkGroupSelections, library.talkGroups, refs.talkGroupIds),
    digitalContacts: assembleEntityList(
      build.contactSelections.length > 0
        ? build.contactSelections.filter((s) =>
            library.digitalContacts.some((c) => c.id === s.libraryEntityId),
          )
        : [],
      library.digitalContacts,
      refs.digitalContactIds,
    ),
    analogContacts: assembleEntityList(
      build.contactSelections.length > 0
        ? build.contactSelections.filter((s) =>
            library.analogContacts.some((c) => c.id === s.libraryEntityId),
          )
        : [],
      library.analogContacts,
      refs.analogContactIds,
    ),
    rxGroupLists: assembleEntityList(
      build.rxGroupListSelections,
      library.rxGroupLists,
      refs.rxGroupListIds,
    ),
  };
}

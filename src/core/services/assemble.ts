import type { BuildEntityOverride, FormatBuild } from '@core/models/formatBuild.ts';
import type {
  AnalogContact,
  Channel,
  DigitalContact,
  RxGroupList,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { ZoneGroupingLayout } from '@core/models/traitLayout.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';
import {
  isEntityExcluded,
  overrideByEntityId,
  resolveOverrideWireName,
} from '@core/domain/formatBuildOverrides.ts';
import { migrateFormatBuild } from '@core/domain/migrateFormatBuild.ts';
import type { Library } from '@core/models/library.ts';

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
  const overrides = build.channelOverrides;
  const assembled: AssembledChannel[] = [];
  for (const entity of library.channels) {
    if (isEntityExcluded(overrides, entity.id)) continue;
    assembled.push({
      entity,
      wireName: resolveOverrideWireName(overrides, entity.id, entity.name),
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
  const overrides = build.zoneOverrides;
  const sections = zoneGroupingSections(build);

  if (sections.length > 0) {
    const assembled: AssembledZone[] = [];
    for (const section of sections) {
      for (const zoneEntry of section.zones) {
        if (isEntityExcluded(overrides, zoneEntry.id)) continue;
        const libraryZone = zonesById.get(zoneEntry.id);
        const fallbackName = libraryZone?.name ?? zoneEntry.name;
        const memberChannelIds = zoneEntry.channelIds.filter((id) => exportedChannelIds.has(id));
        if (memberChannelIds.length === 0 && !overrideByEntityId(overrides).has(zoneEntry.id)) {
          continue;
        }
        assembled.push({
          zoneId: zoneEntry.id,
          wireName: resolveOverrideWireName(overrides, zoneEntry.id, fallbackName),
          memberChannelIds,
        });
      }
    }
    return assembled;
  }

  return library.zones
    .filter((zone) => !isEntityExcluded(overrides, zone.id))
    .map((zone) => {
      const memberChannelIds = zone.members
        .filter((m: EntityRef) => m.kind === 'channel' && exportedChannelIds.has(m.id))
        .map((m) => m.id);
      return {
        zoneId: zone.id,
        wireName: resolveOverrideWireName(overrides, zone.id, zone.name),
        memberChannelIds,
      };
    })
    .filter(
      (z) =>
        z.memberChannelIds.length > 0 || overrideByEntityId(overrides).has(z.zoneId),
    );
}

function assembleEntityList<T extends { id: string; name: string }>(
  overrides: BuildEntityOverride[],
  libraryEntities: T[],
  candidateIds: Set<string>,
): AssembledEntity<T>[] {
  const byId = new Map(libraryEntities.map((entity) => [entity.id, entity]));
  const overrideMap = overrideByEntityId(overrides);
  const ids = new Set(candidateIds);
  for (const row of overrides) {
    ids.add(row.libraryEntityId);
  }

  const assembled: AssembledEntity<T>[] = [];
  for (const entityId of ids) {
    if (isEntityExcluded(overrides, entityId)) continue;
    const entity = byId.get(entityId);
    if (!entity) continue;
    if (!candidateIds.has(entityId) && !overrideMap.has(entityId)) continue;
    assembled.push({
      entity,
      wireName: resolveOverrideWireName(overrides, entity.id, entity.name),
    });
  }
  return assembled;
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
  const normalizedBuild = migrateFormatBuild(build, library as Library);
  const channels = assembleChannels(normalizedBuild, library);
  const exportedChannelIds = new Set(channels.map((c) => c.entity.id));
  const zones = assembleZones(normalizedBuild, library, exportedChannelIds);

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
    channels,
    zones,
    talkGroups: assembleEntityList(
      normalizedBuild.talkGroupOverrides,
      library.talkGroups,
      refs.talkGroupIds,
    ),
    digitalContacts: assembleEntityList(
      normalizedBuild.contactOverrides,
      library.digitalContacts,
      digitalContactIds,
    ),
    analogContacts: assembleEntityList(
      normalizedBuild.contactOverrides,
      library.analogContacts,
      analogContactIds,
    ),
    rxGroupLists: assembleEntityList(
      normalizedBuild.rxGroupListOverrides,
      library.rxGroupLists,
      refs.rxGroupListIds,
    ),
  };
}

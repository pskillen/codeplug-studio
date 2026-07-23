import type { Library } from '@core/models/library.ts';
import { normalizeChannel } from '@core/domain/normalizeChannel.ts';
import { normalizeChannelBehaviourDefaults } from '@core/domain/normalizeChannelBehaviourDefaults.ts';
import { normalizeZoneBehaviourDefaults } from '@core/domain/normalizeZoneBehaviourDefaults.ts';
import { findReferencesTo, type EntityReference } from '@core/domain/references.ts';
import {
  removeChannelsFromZoneMembers,
  zonesWithDirectChannelMember,
} from '@core/domain/zoneMembership.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import type { LibraryEntityKind, ProjectPersistence } from '@integrations/persistence/index.ts';

export type DeleteOutcome = { ok: true } | { ok: false; references: EntityReference[] };

export type DeleteAllDigitalContactsResult = {
  deletedCount: number;
  clearedChannelRefs: number;
  clearedRxMembers: number;
  prunedBuildOverrides: number;
};

/**
 * App-layer service orchestrating library persistence over the
 * {@link ProjectPersistence} port with `core` referential-integrity rules.
 * Per-entity reads/writes use the port's typed methods directly; this service
 * owns the cross-entity concerns (aggregate load, integrity-checked delete).
 */
export class LibraryService {
  constructor(private readonly persistence: ProjectPersistence) {}

  async loadLibrary(projectId: string): Promise<Library> {
    const [
      meta,
      channels,
      zones,
      talkGroups,
      digitalContacts,
      analogContacts,
      rxGroupLists,
      scanLists,
      aprsConfigurations,
    ] = await Promise.all([
      this.persistence.loadProjectMeta(projectId),
      this.persistence.listChannels(projectId),
      this.persistence.listZones(projectId),
      this.persistence.listTalkGroups(projectId),
      this.persistence.listDigitalContacts(projectId),
      this.persistence.listAnalogContacts(projectId),
      this.persistence.listRxGroupLists(projectId),
      this.persistence.listScanLists(projectId),
      this.persistence.listAprsConfigurations(projectId),
    ]);
    const aprsConfiguration = aprsConfigurations[0] ?? null;
    const channelDefaults = normalizeChannelBehaviourDefaults(meta?.channelDefaults);
    const zoneDefaults = normalizeZoneBehaviourDefaults(meta?.zoneDefaults);
    return {
      channels: channels.map(normalizeChannel),
      zones,
      talkGroups,
      digitalContacts,
      analogContacts,
      rxGroupLists,
      scanLists,
      aprsConfiguration,
      channelDefaults,
      zoneDefaults,
    };
  }

  /**
   * Delete a library entity, blocking when other entities still reference it.
   */
  async deleteWithIntegrity(
    projectId: string,
    kind: LibraryEntityKind,
    id: string,
  ): Promise<DeleteOutcome> {
    const library = await this.loadLibrary(projectId);
    const references = findReferencesTo(library, { kind, id });

    if (references.length > 0) {
      return { ok: false, references };
    }
    await this.persistence.deleteEntity(projectId, kind, id);
    return { ok: true };
  }

  /**
   * Wipe every digital contact for a project. Unlike single-row delete, this
   * cascade-clears channel `contactRef`s and RX-list members that point at
   * digital contacts, then clears the contact store without loading all
   * contact rows into an aggregate `Library`.
   */
  async deleteAllDigitalContacts(projectId: string): Promise<DeleteAllDigitalContactsResult> {
    return this.persistence.runWithoutNotifications(async () => {
      let clearedChannelRefs = 0;
      const channels = await this.persistence.listChannels(projectId);
      for (const channel of channels) {
        let changed = false;
        const modeProfiles = channel.modeProfiles.map((profile) => {
          if (profile.mode === 'dmr' && profile.contactRef?.kind === 'digitalContact') {
            clearedChannelRefs += 1;
            changed = true;
            return { ...profile, contactRef: null };
          }
          return profile;
        });
        if (!changed) continue;
        const result = await this.persistence.putChannel(
          { ...channel, modeProfiles },
          channel.revision,
        );
        if (!result.ok) {
          throw new Error(
            result.reason === 'revision_conflict'
              ? 'A channel was changed elsewhere. Reload and try again.'
              : 'Failed to clear channel contact references.',
          );
        }
      }

      let clearedRxMembers = 0;
      const rxGroupLists = await this.persistence.listRxGroupLists(projectId);
      for (const list of rxGroupLists) {
        const nextMembers = list.members.filter((member) => {
          if (member.ref.kind === 'digitalContact') {
            clearedRxMembers += 1;
            return false;
          }
          return true;
        });
        if (nextMembers.length === list.members.length) continue;
        const result = await this.persistence.putRxGroupList(
          { ...list, members: nextMembers },
          list.revision,
        );
        if (!result.ok) {
          throw new Error(
            result.reason === 'revision_conflict'
              ? 'An RX group list was changed elsewhere. Reload and try again.'
              : 'Failed to clear RX group list contact members.',
          );
        }
      }

      let prunedBuildOverrides = 0;
      const analogIds = new Set(
        (await this.persistence.listAnalogContacts(projectId)).map((contact) => contact.id),
      );
      const builds = await this.persistence.listRadioBuilds(projectId);
      for (const build of builds) {
        const nextOverrides = build.contactOverrides.filter((override) =>
          analogIds.has(override.libraryEntityId),
        );
        const pruned = build.contactOverrides.length - nextOverrides.length;
        if (pruned === 0) continue;
        prunedBuildOverrides += pruned;
        const result = await this.persistence.putRadioBuild(
          { ...build, contactOverrides: nextOverrides },
          build.revision,
        );
        if (!result.ok) {
          throw new Error(
            result.reason === 'revision_conflict'
              ? 'A radio build was changed elsewhere. Reload and try again.'
              : 'Failed to prune contact overrides on radio builds.',
          );
        }
      }

      const { deletedCount } = await this.persistence.deleteDigitalContactsForProject(projectId);
      return {
        deletedCount,
        clearedChannelRefs,
        clearedRxMembers,
        prunedBuildOverrides,
      };
    });
  }

  /** Remove a channel from every zone that lists it as a direct member. */
  async removeChannelFromDirectZones(projectId: string, channelId: string): Promise<void> {
    let library = await this.loadLibrary(projectId);
    const targets = zonesWithDirectChannelMember(channelId, library.zones);
    for (const zone of targets) {
      const nextMembers = removeChannelsFromZoneMembers(zone.members, [channelId]);
      const updated = { ...zone, members: nextMembers };
      validateZoneMembership(zone.id, nextMembers, {
        ...library,
        zones: library.zones.map((z) => (z.id === zone.id ? updated : z)),
      });
      const result = await this.persistence.putZone(updated, zone.revision);
      if (!result.ok) {
        throw new Error(
          result.reason === 'revision_conflict'
            ? 'A zone was changed elsewhere. Reload and try again.'
            : 'Failed to update zone membership.',
        );
      }
      library = {
        ...library,
        zones: library.zones.map((z) =>
          z.id === zone.id ? { ...updated, revision: result.revision } : z,
        ),
      };
    }
  }
}

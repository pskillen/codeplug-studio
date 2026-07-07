import type { Library } from '@core/models/library.ts';
import { normalizeChannel } from '@core/domain/normalizeChannel.ts';
import { findReferencesTo, type EntityReference } from '@core/domain/references.ts';
import {
  removeChannelsFromZoneMembers,
  zonesWithDirectChannelMember,
} from '@core/domain/zoneMembership.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import type { LibraryEntityKind, ProjectPersistence } from '@integrations/persistence/index.ts';

export type DeleteOutcome = { ok: true } | { ok: false; references: EntityReference[] };

/**
 * App-layer service orchestrating library persistence over the
 * {@link ProjectPersistence} port with `core` referential-integrity rules.
 * Per-entity reads/writes use the port's typed methods directly; this service
 * owns the cross-entity concerns (aggregate load, integrity-checked delete).
 */
export class LibraryService {
  constructor(private readonly persistence: ProjectPersistence) {}

  async loadLibrary(projectId: string): Promise<Library> {
    const [channels, zones, talkGroups, digitalContacts, analogContacts, rxGroupLists] =
      await Promise.all([
        this.persistence.listChannels(projectId),
        this.persistence.listZones(projectId),
        this.persistence.listTalkGroups(projectId),
        this.persistence.listDigitalContacts(projectId),
        this.persistence.listAnalogContacts(projectId),
        this.persistence.listRxGroupLists(projectId),
      ]);
    return {
      channels: channels.map(normalizeChannel),
      zones,
      talkGroups,
      digitalContacts,
      analogContacts,
      rxGroupLists,
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

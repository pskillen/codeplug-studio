import type { Library } from '@core/models/library.ts';
import { findReferencesTo, type EntityReference } from '@core/domain/references.ts';
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
    return { channels, zones, talkGroups, digitalContacts, analogContacts, rxGroupLists };
  }

  /**
   * Delete a library entity, blocking when other entities still reference it.
   * Zones are not referenced by other library entities, so they delete freely.
   */
  async deleteWithIntegrity(
    projectId: string,
    kind: LibraryEntityKind,
    id: string,
  ): Promise<DeleteOutcome> {
    if (kind !== 'zone') {
      const library = await this.loadLibrary(projectId);
      const references = findReferencesTo(library, { kind, id });
      if (references.length > 0) {
        return { ok: false, references };
      }
    }
    await this.persistence.deleteEntity(projectId, kind, id);
    return { ok: true };
  }
}

import type { FormatBuild } from '@core/models/formatBuild.ts';
import type {
  AnalogContact,
  Channel,
  DigitalContact,
  RxGroupList,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { isoNow, nextRevision } from '@core/models/revision.ts';
import type {
  EntityKind,
  PersistenceChange,
  PersistenceListener,
  ProjectPersistence,
  ProjectSeed,
  PutResult,
} from './types.ts';
import { assertSeedProjectId } from './projectSeed.ts';

type RowMap<T extends { id: string; projectId: string }> = Map<string, T>;

function rowKey(projectId: string, id: string): string {
  return `${projectId}:${id}`;
}

function checkRevision<T extends { revision: number }>(
  stored: T | undefined,
  expectedRevision: number | null,
): PutResult | null {
  if (stored && expectedRevision !== null && stored.revision !== expectedRevision) {
    return { ok: false, reason: 'revision_conflict' };
  }
  return null;
}

export class InMemoryProjectPersistence implements ProjectPersistence {
  private projects: RowMap<ProjectMeta> = new Map();
  private channels: RowMap<Channel> = new Map();
  private zones: RowMap<Zone> = new Map();
  private talkGroups: RowMap<TalkGroup> = new Map();
  private digitalContacts: RowMap<DigitalContact> = new Map();
  private analogContacts: RowMap<AnalogContact> = new Map();
  private rxGroupLists: RowMap<RxGroupList> = new Map();
  private formatBuilds: RowMap<FormatBuild> = new Map();
  private listeners = new Set<PersistenceListener>();

  async listProjects(): Promise<ProjectMeta[]> {
    return [...this.projects.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  async loadProjectMeta(projectId: string): Promise<ProjectMeta | null> {
    return this.projects.get(rowKey(projectId, projectId)) ?? null;
  }

  async putProjectMeta(row: ProjectMeta, expectedRevision: number | null): Promise<PutResult> {
    const key = rowKey(row.projectId, row.id);
    const stored = this.projects.get(key);
    const conflict = checkRevision(stored, expectedRevision);
    if (conflict) return conflict;
    const updated: ProjectMeta = {
      ...row,
      revision: stored ? nextRevision(stored.revision) : row.revision,
      updatedAt: isoNow(),
    };
    this.projects.set(key, updated);
    this.emit({ projectId: row.projectId, kind: 'project', id: row.id, op: 'put' });
    return { ok: true, revision: updated.revision };
  }

  async getChannel(projectId: string, id: string): Promise<Channel | null> {
    return this.channels.get(rowKey(projectId, id)) ?? null;
  }

  async putChannel(row: Channel, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('channel', this.channels, row, expectedRevision);
  }

  async listChannels(projectId: string): Promise<Channel[]> {
    return this.listRows(this.channels, projectId);
  }

  async getZone(projectId: string, id: string): Promise<Zone | null> {
    return this.zones.get(rowKey(projectId, id)) ?? null;
  }

  async putZone(row: Zone, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('zone', this.zones, row, expectedRevision);
  }

  async listZones(projectId: string): Promise<Zone[]> {
    return this.listRows(this.zones, projectId);
  }

  async getTalkGroup(projectId: string, id: string): Promise<TalkGroup | null> {
    return this.talkGroups.get(rowKey(projectId, id)) ?? null;
  }

  async putTalkGroup(row: TalkGroup, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('talkGroup', this.talkGroups, row, expectedRevision);
  }

  async listTalkGroups(projectId: string): Promise<TalkGroup[]> {
    return this.listRows(this.talkGroups, projectId);
  }

  async getDigitalContact(projectId: string, id: string): Promise<DigitalContact | null> {
    return this.digitalContacts.get(rowKey(projectId, id)) ?? null;
  }

  async putDigitalContact(
    row: DigitalContact,
    expectedRevision: number | null,
  ): Promise<PutResult> {
    return this.putRow('digitalContact', this.digitalContacts, row, expectedRevision);
  }

  async listDigitalContacts(projectId: string): Promise<DigitalContact[]> {
    return this.listRows(this.digitalContacts, projectId);
  }

  async getAnalogContact(projectId: string, id: string): Promise<AnalogContact | null> {
    return this.analogContacts.get(rowKey(projectId, id)) ?? null;
  }

  async putAnalogContact(row: AnalogContact, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('analogContact', this.analogContacts, row, expectedRevision);
  }

  async listAnalogContacts(projectId: string): Promise<AnalogContact[]> {
    return this.listRows(this.analogContacts, projectId);
  }

  async getRxGroupList(projectId: string, id: string): Promise<RxGroupList | null> {
    return this.rxGroupLists.get(rowKey(projectId, id)) ?? null;
  }

  async putRxGroupList(row: RxGroupList, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('rxGroupList', this.rxGroupLists, row, expectedRevision);
  }

  async listRxGroupLists(projectId: string): Promise<RxGroupList[]> {
    return this.listRows(this.rxGroupLists, projectId);
  }

  async getFormatBuild(projectId: string, id: string): Promise<FormatBuild | null> {
    return this.formatBuilds.get(rowKey(projectId, id)) ?? null;
  }

  async putFormatBuild(row: FormatBuild, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('formatBuild', this.formatBuilds, row, expectedRevision);
  }

  async listFormatBuilds(projectId: string): Promise<FormatBuild[]> {
    return this.listRows(this.formatBuilds, projectId);
  }

  async deleteEntity(projectId: string, kind: EntityKind, id: string): Promise<void> {
    if (kind === 'project') {
      this.deleteAllProjectRows(projectId);
      this.emit({ projectId, kind, id, op: 'delete' });
      return;
    }
    const map = this.mapForKind(kind);
    if (!map) return;
    map.delete(rowKey(projectId, id));
    this.emit({ projectId, kind, id, op: 'delete' });
  }

  async loadProjectSeed(projectId: string): Promise<ProjectSeed | null> {
    const meta = await this.loadProjectMeta(projectId);
    if (!meta) return null;
    const [
      channels,
      zones,
      talkGroups,
      digitalContacts,
      analogContacts,
      rxGroupLists,
      formatBuilds,
    ] = await Promise.all([
      this.listChannels(projectId),
      this.listZones(projectId),
      this.listTalkGroups(projectId),
      this.listDigitalContacts(projectId),
      this.listAnalogContacts(projectId),
      this.listRxGroupLists(projectId),
      this.listFormatBuilds(projectId),
    ]);
    return {
      meta,
      channels,
      zones,
      talkGroups,
      digitalContacts,
      analogContacts,
      rxGroupLists,
      formatBuilds,
    };
  }

  async replaceProject(projectId: string, seed: ProjectSeed): Promise<void> {
    assertSeedProjectId(projectId, seed);
    this.deleteAllProjectRows(projectId);
    this.writeSeed(seed);
    this.emit({ projectId, kind: 'project', id: seed.meta.id, op: 'put' });
  }

  async seedProject(seed: ProjectSeed): Promise<void> {
    this.writeSeed(seed);
    this.emit({ projectId: seed.meta.projectId, kind: 'project', id: seed.meta.id, op: 'put' });
  }

  subscribe(listener: PersistenceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private writeSeed(seed: ProjectSeed): void {
    const { meta } = seed;
    this.projects.set(rowKey(meta.projectId, meta.id), { ...meta });
    for (const row of seed.channels ?? []) {
      this.channels.set(rowKey(row.projectId, row.id), { ...row });
    }
    for (const row of seed.zones ?? []) {
      this.zones.set(rowKey(row.projectId, row.id), { ...row });
    }
    for (const row of seed.talkGroups ?? []) {
      this.talkGroups.set(rowKey(row.projectId, row.id), { ...row });
    }
    for (const row of seed.digitalContacts ?? []) {
      this.digitalContacts.set(rowKey(row.projectId, row.id), { ...row });
    }
    for (const row of seed.analogContacts ?? []) {
      this.analogContacts.set(rowKey(row.projectId, row.id), { ...row });
    }
    for (const row of seed.rxGroupLists ?? []) {
      this.rxGroupLists.set(rowKey(row.projectId, row.id), { ...row });
    }
    for (const row of seed.formatBuilds ?? []) {
      this.formatBuilds.set(rowKey(row.projectId, row.id), { ...row });
    }
  }

  private deleteAllProjectRows(projectId: string): void {
    for (const map of [
      this.projects,
      this.channels,
      this.zones,
      this.talkGroups,
      this.digitalContacts,
      this.analogContacts,
      this.rxGroupLists,
      this.formatBuilds,
    ]) {
      for (const [key, row] of [...map.entries()]) {
        if (row.projectId === projectId) {
          map.delete(key);
        }
      }
    }
  }

  private emit(change: PersistenceChange): void {
    for (const listener of this.listeners) {
      listener(change);
    }
  }

  private listRows<T extends { id: string; projectId: string; name?: string }>(
    store: RowMap<T>,
    projectId: string,
  ): T[] {
    return [...store.values()]
      .filter((row) => row.projectId === projectId)
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }

  private putRow<T extends { id: string; projectId: string; revision: number }>(
    kind: EntityKind,
    store: RowMap<T>,
    row: T,
    expectedRevision: number | null,
  ): PutResult {
    const key = rowKey(row.projectId, row.id);
    const stored = store.get(key);
    const conflict = checkRevision(stored, expectedRevision);
    if (conflict) return conflict;
    const updated = {
      ...row,
      revision: stored ? nextRevision(stored.revision) : row.revision,
      updatedAt: isoNow(),
    } as T & { updatedAt: string };
    store.set(key, updated);
    this.emit({ projectId: row.projectId, kind, id: row.id, op: 'put' });
    return { ok: true, revision: updated.revision };
  }

  private mapForKind(
    kind: EntityKind,
  ): RowMap<
    Channel | Zone | TalkGroup | DigitalContact | AnalogContact | RxGroupList | FormatBuild
  > | null {
    switch (kind) {
      case 'channel':
        return this.channels;
      case 'zone':
        return this.zones;
      case 'talkGroup':
        return this.talkGroups;
      case 'digitalContact':
        return this.digitalContacts;
      case 'analogContact':
        return this.analogContacts;
      case 'rxGroupList':
        return this.rxGroupLists;
      case 'formatBuild':
        return this.formatBuilds;
      case 'project':
        return null;
      default:
        return null;
    }
  }
}

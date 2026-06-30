import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Channel, Contact, RxGroupList, TalkGroup } from '@core/models/library.ts';
import type { ProjectMeta } from '@core/models/project.ts';
import { isoNow, nextRevision } from '@core/models/revision.ts';
import type { EntityKind, PutResult } from './types.ts';

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

export interface ProjectSeed {
  meta: ProjectMeta;
  channels?: Channel[];
  talkGroups?: TalkGroup[];
  contacts?: Contact[];
  rxGroupLists?: RxGroupList[];
  formatBuilds?: FormatBuild[];
}

export class InMemoryProjectPersistence {
  private projects: RowMap<ProjectMeta> = new Map();
  private channels: RowMap<Channel> = new Map();
  private talkGroups: RowMap<TalkGroup> = new Map();
  private contacts: RowMap<Contact> = new Map();
  private rxGroupLists: RowMap<RxGroupList> = new Map();
  private formatBuilds: RowMap<FormatBuild> = new Map();

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
    return { ok: true, revision: updated.revision };
  }

  async getChannel(projectId: string, id: string): Promise<Channel | null> {
    return this.channels.get(rowKey(projectId, id)) ?? null;
  }

  async putChannel(row: Channel, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow(this.channels, row, expectedRevision);
  }

  async getTalkGroup(projectId: string, id: string): Promise<TalkGroup | null> {
    return this.talkGroups.get(rowKey(projectId, id)) ?? null;
  }

  async putTalkGroup(row: TalkGroup, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow(this.talkGroups, row, expectedRevision);
  }

  async getContact(projectId: string, id: string): Promise<Contact | null> {
    return this.contacts.get(rowKey(projectId, id)) ?? null;
  }

  async putContact(row: Contact, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow(this.contacts, row, expectedRevision);
  }

  async getRxGroupList(projectId: string, id: string): Promise<RxGroupList | null> {
    return this.rxGroupLists.get(rowKey(projectId, id)) ?? null;
  }

  async putRxGroupList(row: RxGroupList, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow(this.rxGroupLists, row, expectedRevision);
  }

  async getFormatBuild(projectId: string, id: string): Promise<FormatBuild | null> {
    return this.formatBuilds.get(rowKey(projectId, id)) ?? null;
  }

  async putFormatBuild(row: FormatBuild, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow(this.formatBuilds, row, expectedRevision);
  }

  async deleteEntity(
    projectId: string,
    kind: EntityKind,
    id: string,
  ): Promise<void> {
    const map = this.mapForKind(kind);
    if (!map) return;
    map.delete(rowKey(projectId, id));
  }

  async seedProject(seed: ProjectSeed): Promise<void> {
    const { meta } = seed;
    this.projects.set(rowKey(meta.projectId, meta.id), { ...meta });
    for (const row of seed.channels ?? []) {
      this.channels.set(rowKey(row.projectId, row.id), { ...row });
    }
    for (const row of seed.talkGroups ?? []) {
      this.talkGroups.set(rowKey(row.projectId, row.id), { ...row });
    }
    for (const row of seed.contacts ?? []) {
      this.contacts.set(rowKey(row.projectId, row.id), { ...row });
    }
    for (const row of seed.rxGroupLists ?? []) {
      this.rxGroupLists.set(rowKey(row.projectId, row.id), { ...row });
    }
    for (const row of seed.formatBuilds ?? []) {
      this.formatBuilds.set(rowKey(row.projectId, row.id), { ...row });
    }
  }

  private putRow<T extends { id: string; projectId: string; revision: number }>(
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
    return { ok: true, revision: updated.revision };
  }

  private mapForKind(
    kind: EntityKind,
  ): RowMap<Channel | TalkGroup | Contact | RxGroupList | FormatBuild | ProjectMeta> | null {
    switch (kind) {
      case 'project':
        return this.projects;
      case 'channel':
        return this.channels;
      case 'talkGroup':
        return this.talkGroups;
      case 'contact':
        return this.contacts;
      case 'rxGroupList':
        return this.rxGroupLists;
      case 'formatBuild':
        return this.formatBuilds;
      default:
        return null;
    }
  }
}

export type ProjectPersistence = InMemoryProjectPersistence;

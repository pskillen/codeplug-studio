import { STUDIO_SCHEMA_VERSION } from '@core/models/schemaVersion.ts';
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
import { DEFAULT_DB_NAME, STORES, STORE_NAMES } from './stores.ts';
import { assertSeedProjectId } from './projectSeed.ts';
import { readChannelRow } from './channelRow.ts';
import { readFormatBuildRow } from './formatBuildRow.ts';

type PersistableRow = {
  id: string;
  projectId: string;
  revision: number;
  updatedAt: string;
  name?: string;
};

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * IndexedDB implementation of {@link ProjectPersistence}. Stores one row per
 * entity (keyed by `[projectId, id]`) across per-kind object stores, enforces
 * optimistic concurrency via `revision`, and broadcasts {@link PersistenceChange}
 * events to other tabs via `BroadcastChannel`.
 *
 * See docs/poc-migration/storage.md for the design rationale.
 */
export class IndexedDbProjectPersistence implements ProjectPersistence {
  private readonly dbName: string;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly listeners = new Set<PersistenceListener>();
  private readonly channel: BroadcastChannel | null;

  constructor(dbName: string = DEFAULT_DB_NAME) {
    this.dbName = dbName;
    this.channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(`${dbName}:persistence`)
        : null;
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<PersistenceChange>) => {
        this.notifyLocal(event.data);
      };
    }
  }

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = this.open();
    }
    return this.dbPromise;
  }

  private open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is not available in this environment'));
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, STUDIO_SCHEMA_VERSION);
      // Migration hook: create/upgrade stores as the schema version bumps.
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(store)) {
            const os = db.createObjectStore(store, { keyPath: ['projectId', 'id'] });
            os.createIndex('byProject', 'projectId', { unique: false });
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async listProjects(): Promise<ProjectMeta[]> {
    const db = await this.db();
    const tx = db.transaction(STORES.project, 'readonly');
    const rows = await promisifyRequest<ProjectMeta[]>(tx.objectStore(STORES.project).getAll());
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }

  async loadProjectMeta(projectId: string): Promise<ProjectMeta | null> {
    return this.getRow<ProjectMeta>('project', projectId, projectId);
  }

  async putProjectMeta(row: ProjectMeta, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('project', row, expectedRevision);
  }

  async getChannel(projectId: string, id: string): Promise<Channel | null> {
    const row = await this.getRow<Channel>('channel', projectId, id);
    return row ? readChannelRow(row) : null;
  }
  async putChannel(row: Channel, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('channel', row, expectedRevision);
  }
  async listChannels(projectId: string): Promise<Channel[]> {
    const rows = await this.listRows<Channel>('channel', projectId);
    return rows.map(readChannelRow);
  }

  async getZone(projectId: string, id: string): Promise<Zone | null> {
    return this.getRow<Zone>('zone', projectId, id);
  }
  async putZone(row: Zone, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('zone', row, expectedRevision);
  }
  async listZones(projectId: string): Promise<Zone[]> {
    return this.listRows<Zone>('zone', projectId);
  }

  async getTalkGroup(projectId: string, id: string): Promise<TalkGroup | null> {
    return this.getRow<TalkGroup>('talkGroup', projectId, id);
  }
  async putTalkGroup(row: TalkGroup, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('talkGroup', row, expectedRevision);
  }
  async listTalkGroups(projectId: string): Promise<TalkGroup[]> {
    return this.listRows<TalkGroup>('talkGroup', projectId);
  }

  async getDigitalContact(projectId: string, id: string): Promise<DigitalContact | null> {
    return this.getRow<DigitalContact>('digitalContact', projectId, id);
  }
  async putDigitalContact(
    row: DigitalContact,
    expectedRevision: number | null,
  ): Promise<PutResult> {
    return this.putRow('digitalContact', row, expectedRevision);
  }
  async listDigitalContacts(projectId: string): Promise<DigitalContact[]> {
    return this.listRows<DigitalContact>('digitalContact', projectId);
  }

  async getAnalogContact(projectId: string, id: string): Promise<AnalogContact | null> {
    return this.getRow<AnalogContact>('analogContact', projectId, id);
  }
  async putAnalogContact(row: AnalogContact, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('analogContact', row, expectedRevision);
  }
  async listAnalogContacts(projectId: string): Promise<AnalogContact[]> {
    return this.listRows<AnalogContact>('analogContact', projectId);
  }

  async getRxGroupList(projectId: string, id: string): Promise<RxGroupList | null> {
    return this.getRow<RxGroupList>('rxGroupList', projectId, id);
  }
  async putRxGroupList(row: RxGroupList, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('rxGroupList', row, expectedRevision);
  }
  async listRxGroupLists(projectId: string): Promise<RxGroupList[]> {
    return this.listRows<RxGroupList>('rxGroupList', projectId);
  }

  async getFormatBuild(projectId: string, id: string): Promise<FormatBuild | null> {
    const row = await this.getRow<FormatBuild>('formatBuild', projectId, id);
    return row ? readFormatBuildRow(row) : null;
  }
  async putFormatBuild(row: FormatBuild, expectedRevision: number | null): Promise<PutResult> {
    return this.putRow('formatBuild', readFormatBuildRow(row), expectedRevision);
  }
  async listFormatBuilds(projectId: string): Promise<FormatBuild[]> {
    const rows = await this.listRows<FormatBuild>('formatBuild', projectId);
    return rows.map(readFormatBuildRow);
  }

  async deleteEntity(projectId: string, kind: EntityKind, id: string): Promise<void> {
    if (kind === 'project') {
      await this.deleteAllProjectRows(projectId);
      this.emit({ projectId, kind, id, op: 'delete' });
      return;
    }
    const db = await this.db();
    const storeName = STORES[kind];
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete([projectId, id]);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
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
    const db = await this.db();
    const writes: { kind: EntityKind; rows: PersistableRow[] }[] = [
      { kind: 'project', rows: [seed.meta] },
      { kind: 'channel', rows: seed.channels ?? [] },
      { kind: 'zone', rows: seed.zones ?? [] },
      { kind: 'talkGroup', rows: seed.talkGroups ?? [] },
      { kind: 'digitalContact', rows: seed.digitalContacts ?? [] },
      { kind: 'analogContact', rows: seed.analogContacts ?? [] },
      { kind: 'rxGroupList', rows: seed.rxGroupLists ?? [] },
      { kind: 'formatBuild', rows: seed.formatBuilds ?? [] },
    ];
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES, 'readwrite');
      let pendingStores = STORE_NAMES.length;
      let putsScheduled = false;

      const schedulePuts = () => {
        if (putsScheduled) return;
        putsScheduled = true;
        for (const { kind, rows } of writes) {
          const os = tx.objectStore(STORES[kind]);
          for (const row of rows) os.put(row);
        }
      };

      const onStoreDone = () => {
        pendingStores -= 1;
        if (pendingStores === 0) schedulePuts();
      };

      for (const storeName of STORE_NAMES) {
        const os = tx.objectStore(storeName);
        const req = os.index('byProject').openKeyCursor(IDBKeyRange.only(projectId));
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            os.delete(cursor.primaryKey);
            cursor.continue();
          } else {
            onStoreDone();
          }
        };
        req.onerror = () => reject(req.error);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    this.emit({ projectId, kind: 'project', id: seed.meta.id, op: 'put' });
  }

  async seedProject(seed: ProjectSeed): Promise<void> {
    const db = await this.db();
    const { meta } = seed;
    const writes: { kind: EntityKind; rows: PersistableRow[] }[] = [
      { kind: 'project', rows: [meta] },
      { kind: 'channel', rows: seed.channels ?? [] },
      { kind: 'zone', rows: seed.zones ?? [] },
      { kind: 'talkGroup', rows: seed.talkGroups ?? [] },
      { kind: 'digitalContact', rows: seed.digitalContacts ?? [] },
      { kind: 'analogContact', rows: seed.analogContacts ?? [] },
      { kind: 'rxGroupList', rows: seed.rxGroupLists ?? [] },
      { kind: 'formatBuild', rows: seed.formatBuilds ?? [] },
    ];
    const storeNames = writes.map((w) => STORES[w.kind]);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeNames, 'readwrite');
      for (const { kind, rows } of writes) {
        const os = tx.objectStore(STORES[kind]);
        for (const row of rows) os.put(row);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    this.emit({ projectId: meta.projectId, kind: 'project', id: meta.id, op: 'put' });
  }

  subscribe(listener: PersistenceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Release the BroadcastChannel. Mainly for tests / teardown. */
  close(): void {
    this.channel?.close();
  }

  private async getRow<T>(kind: EntityKind, projectId: string, id: string): Promise<T | null> {
    const db = await this.db();
    const storeName = STORES[kind];
    const tx = db.transaction(storeName, 'readonly');
    const row = await promisifyRequest<T | undefined>(
      tx.objectStore(storeName).get([projectId, id]),
    );
    return row ?? null;
  }

  private async listRows<T extends { name?: string }>(
    kind: EntityKind,
    projectId: string,
  ): Promise<T[]> {
    const db = await this.db();
    const storeName = STORES[kind];
    const tx = db.transaction(storeName, 'readonly');
    const index = tx.objectStore(storeName).index('byProject');
    const rows = await promisifyRequest<T[]>(index.getAll(projectId));
    return rows.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }

  private async putRow<T extends PersistableRow>(
    kind: EntityKind,
    row: T,
    expectedRevision: number | null,
  ): Promise<PutResult> {
    const db = await this.db();
    const storeName = STORES[kind];
    const result = await new Promise<PutResult>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const os = tx.objectStore(storeName);
      const getReq = os.get([row.projectId, row.id]);
      let outcome: PutResult = { ok: false, reason: 'not_found' };
      getReq.onsuccess = () => {
        const stored = getReq.result as T | undefined;
        if (stored && expectedRevision !== null && stored.revision !== expectedRevision) {
          outcome = { ok: false, reason: 'revision_conflict' };
          return; // skip write; transaction completes without change
        }
        const revision = stored ? nextRevision(stored.revision) : row.revision;
        const updated = { ...row, revision, updatedAt: isoNow() };
        os.put(updated);
        outcome = { ok: true, revision };
      };
      tx.oncomplete = () => resolve(outcome);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    if (result.ok) {
      this.emit({ projectId: row.projectId, kind, id: row.id, op: 'put' });
    }
    return result;
  }

  private async deleteAllProjectRows(projectId: string): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAMES, 'readwrite');

      for (const storeName of STORE_NAMES) {
        const os = tx.objectStore(storeName);
        const req = os.index('byProject').openKeyCursor(IDBKeyRange.only(projectId));
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            os.delete(cursor.primaryKey);
            cursor.continue();
          }
        };
        req.onerror = () => reject(req.error);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  private emit(change: PersistenceChange): void {
    this.notifyLocal(change);
    this.channel?.postMessage(change);
  }

  private notifyLocal(change: PersistenceChange): void {
    for (const listener of this.listeners) {
      listener(change);
    }
  }
}

/** Convenience factory mirroring a future async-open API. */
export function openProjectPersistence(dbName?: string): IndexedDbProjectPersistence {
  return new IndexedDbProjectPersistence(dbName);
}

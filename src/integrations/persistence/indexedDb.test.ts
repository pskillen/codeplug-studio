import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  newAprsConfiguration,
  newChannel,
  newDigitalContact,
  newProjectMeta,
  newRadioBuildWithEgresses,
  newTalkGroup,
} from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import { IndexedDbProjectPersistence } from './indexedDb.ts';
import type { PersistenceChange } from './types.ts';

let counter = 0;
const open = new Set<IndexedDbProjectPersistence>();

function makeStore(): IndexedDbProjectPersistence {
  // Unique DB name per store keeps tests isolated under fake-indexeddb.
  const store = new IndexedDbProjectPersistence(`test-db-${counter++}`);
  open.add(store);
  return store;
}

afterEach(() => {
  for (const store of open) store.close();
  open.clear();
});

describe('IndexedDbProjectPersistence', () => {
  it('seeds and lists projects', async () => {
    const store = makeStore();
    await store.seedProject({ meta: newProjectMeta('North Wales') });

    const list = await store.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('North Wales');
  });

  it('persists channels and lists them sorted by name', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    await store.putChannel(newChannel(meta.projectId, 'Zulu'), null);
    await store.putChannel(newChannel(meta.projectId, 'Alpha'), null);

    const channels = await store.listChannels(meta.projectId);
    expect(channels.map((c) => c.name)).toEqual(['Alpha', 'Zulu']);
  });

  it('defaults scanInclusion when reading legacy channel rows', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Legacy');
    const { scanInclusion: _scanInclusion, ...legacyRow } = channel;
    void _scanInclusion;
    const legacyStoredRow: Omit<Channel, 'scanInclusion'> & { scanSkip: boolean } = {
      ...legacyRow,
      scanSkip: true,
    };
    await store.seedProject({
      meta,
      // Pre-schema-v8 rows persisted without scanInclusion.
      channels: [legacyStoredRow as unknown as Channel],
    });

    const loaded = await store.getChannel(meta.projectId, channel.id);
    expect(loaded?.scanInclusion).toBe('skip');
    expect(loaded).not.toHaveProperty('scanSkip');
  });

  it('migrates legacy ssb-usb mode profiles on read', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'SSB Legacy');
    const legacyChannel: Channel = {
      ...channel,
      modeProfiles: [
        {
          mode: 'ssb-usb',
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: null,
        } as unknown as Channel['modeProfiles'][number],
      ],
    };
    await store.seedProject({ meta, channels: [legacyChannel] });

    const loaded = await store.getChannel(meta.projectId, channel.id);
    expect(loaded?.modeProfiles).toHaveLength(1);
    const profile = loaded?.modeProfiles[0];
    expect(profile?.mode).toBe('ssb');
    if (profile?.mode === 'ssb') {
      expect(profile.ssbSideband).toBe('usb');
    }
  });

  it('bumps revision on update and rejects stale writes', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Local');
    await store.seedProject({ meta, channels: [channel] });

    const ok = await store.putChannel({ ...channel, name: 'Local 2' }, channel.revision);
    expect(ok).toEqual({ ok: true, revision: 2 });

    const loaded = await store.getChannel(meta.projectId, channel.id);
    expect(loaded?.name).toBe('Local 2');
    expect(loaded?.revision).toBe(2);

    const conflict = await store.putChannel({ ...channel, name: 'Local 3' }, 1);
    expect(conflict).toEqual({ ok: false, reason: 'revision_conflict' });
  });

  it('deletes an entity', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const tg = newTalkGroup(meta.projectId, 'World', 91);
    await store.seedProject({ meta, talkGroups: [tg] });

    await store.deleteEntity(meta.projectId, 'talkGroup', tg.id);
    expect(await store.getTalkGroup(meta.projectId, tg.id)).toBeNull();
    expect(await store.listTalkGroups(meta.projectId)).toHaveLength(0);
  });

  it('isolates rows per project', async () => {
    const store = makeStore();
    const metaA = newProjectMeta('A');
    const metaB = newProjectMeta('B');
    await store.seedProject({ meta: metaA, channels: [newChannel(metaA.projectId, 'A-ch')] });
    await store.seedProject({ meta: metaB, channels: [newChannel(metaB.projectId, 'B-ch')] });

    expect(await store.listChannels(metaA.projectId)).toHaveLength(1);
    expect(await store.listChannels(metaB.projectId)).toHaveLength(1);
  });

  it('notifies local subscribers and broadcasts cross-tab', async () => {
    const dbName = `shared-db-${counter++}`;
    const tabA = new IndexedDbProjectPersistence(dbName);
    const tabB = new IndexedDbProjectPersistence(dbName);
    open.add(tabA);
    open.add(tabB);

    const local: PersistenceChange[] = [];
    const crossTab: PersistenceChange[] = [];
    tabA.subscribe((c) => local.push(c));
    tabB.subscribe((c) => crossTab.push(c));

    const meta = newProjectMeta('Test');
    await tabA.seedProject({ meta });
    const channel = newChannel(meta.projectId, 'Local');
    await tabA.putChannel(channel, null);

    // BroadcastChannel delivers asynchronously; let the microtask/macrotask flush.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(local).toContainEqual({
      projectId: meta.projectId,
      kind: 'channel',
      id: channel.id,
      op: 'put',
    });
    expect(crossTab).toContainEqual({
      projectId: meta.projectId,
      kind: 'channel',
      id: channel.id,
      op: 'put',
    });
  });

  it('persists a single aprs configuration per project', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    const zulu = newAprsConfiguration(meta.projectId, 'Zulu');
    const alpha = newAprsConfiguration(meta.projectId, 'Alpha');
    await store.putAprsConfiguration(zulu, null);
    await store.putAprsConfiguration(alpha, null);

    const configs = await store.listAprsConfigurations(meta.projectId);
    expect(configs).toHaveLength(1);
    expect(configs[0]?.name).toBe('Alpha');
    expect(await store.getAprsConfiguration(meta.projectId, zulu.id)).toBeNull();
    expect(await store.getAprsConfiguration(meta.projectId, alpha.id)).toMatchObject({
      name: 'Alpha',
    });
  });

  it('loadProjectSeed returns full aggregate including radioBuilds and egressPaths', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Local');
    const { build, egressPaths } = newRadioBuildWithEgresses(meta.projectId, 'baofeng-dm1701');
    await store.seedProject({
      meta,
      channels: [channel],
      radioBuilds: [build],
      egressPaths,
    });

    const seed = await store.loadProjectSeed(meta.projectId);
    expect(seed?.meta.id).toBe(meta.id);
    expect(seed?.channels).toHaveLength(1);
    expect(seed?.radioBuilds).toHaveLength(1);
    expect(seed?.radioBuilds?.[0]?.id).toBe(build.id);
    expect(seed?.egressPaths).toHaveLength(egressPaths.length);
  });

  it('putRadioBuild and putEgressPath persist and read back rows', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    const { build, egressPaths } = newRadioBuildWithEgresses(meta.projectId, 'baofeng-uv5r-mini');

    await store.putRadioBuild(build, null);
    for (const egress of egressPaths) {
      await store.putEgressPath(egress, null);
    }

    expect(await store.getRadioBuild(meta.projectId, build.id)).toMatchObject({ id: build.id });
    expect(await store.listRadioBuilds(meta.projectId)).toHaveLength(1);
    expect(await store.listEgressPaths(meta.projectId)).toHaveLength(egressPaths.length);
  });

  it('listEgressPathsForBuild scopes to one radio build', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    const buildA = newRadioBuildWithEgresses(meta.projectId, 'baofeng-uv5r-mini', 'A');
    const buildB = newRadioBuildWithEgresses(meta.projectId, 'baofeng-dm1701', 'B');
    await store.putRadioBuild(buildA.build, null);
    await store.putRadioBuild(buildB.build, null);
    for (const egress of [...buildA.egressPaths, ...buildB.egressPaths]) {
      await store.putEgressPath(egress, null);
    }

    const forA = await store.listEgressPathsForBuild(meta.projectId, buildA.build.id);
    const forB = await store.listEgressPathsForBuild(meta.projectId, buildB.build.id);
    expect(forA).toHaveLength(buildA.egressPaths.length);
    expect(forA.every((row) => row.radioBuildId === buildA.build.id)).toBe(true);
    expect(forB).toHaveLength(buildB.egressPaths.length);
    expect(forB.every((row) => row.radioBuildId === buildB.build.id)).toBe(true);
  });

  it('upgrading a legacy DB drops formatBuilds but keeps the library', async () => {
    const dbName = `legacy-db-${counter++}`;
    const meta = newProjectMeta('Legacy');
    const channel = newChannel(meta.projectId, 'Kept');

    // Simulate a pre-#654 DB: projects/channels + the now-removed formatBuilds store.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const projects = db.createObjectStore('projects', { keyPath: ['projectId', 'id'] });
        projects.createIndex('byProject', 'projectId', { unique: false });
        const channels = db.createObjectStore('channels', { keyPath: ['projectId', 'id'] });
        channels.createIndex('byProject', 'projectId', { unique: false });
        const legacyBuilds = db.createObjectStore('formatBuilds', { keyPath: ['projectId', 'id'] });
        legacyBuilds.createIndex('byProject', 'projectId', { unique: false });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['projects', 'channels', 'formatBuilds'], 'readwrite');
        tx.objectStore('projects').put(meta);
        tx.objectStore('channels').put(channel);
        tx.objectStore('formatBuilds').put({
          id: 'legacy-build',
          projectId: meta.projectId,
          revision: 1,
          updatedAt: meta.updatedAt,
          name: 'Legacy build',
          formatId: 'opengd77',
          profileId: 'opengd77-1701',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const store = new IndexedDbProjectPersistence(dbName);
    open.add(store);

    expect(await store.loadProjectMeta(meta.projectId)).toMatchObject({ name: 'Legacy' });
    expect(await store.listChannels(meta.projectId)).toHaveLength(1);
    expect(await store.listRadioBuilds(meta.projectId)).toHaveLength(0);

    const rawDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(rawDb.objectStoreNames.contains('formatBuilds')).toBe(false);
    expect(rawDb.objectStoreNames.contains('radioBuilds')).toBe(true);
    expect(rawDb.objectStoreNames.contains('egressPaths')).toBe(true);
    rawDb.close();
  });

  it('replaceProject removes stale rows from a prior seed', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const oldChannel = newChannel(meta.projectId, 'Old');
    const newChannelRow = newChannel(meta.projectId, 'New');
    await store.seedProject({ meta, channels: [oldChannel] });

    await store.replaceProject(meta.projectId, {
      meta,
      channels: [newChannelRow],
    });

    expect(await store.getChannel(meta.projectId, oldChannel.id)).toBeNull();
    expect(await store.getChannel(meta.projectId, newChannelRow.id)).not.toBeNull();
    expect(await store.listChannels(meta.projectId)).toHaveLength(1);
  });

  it('putDigitalContactsBatch persists rows in one transaction', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    const batch = await store.putDigitalContactsBatch([
      { row: newDigitalContact(meta.projectId, 'Alpha', 1, 'dmr'), expectedRevision: null },
      { row: newDigitalContact(meta.projectId, 'Bravo', 2, 'dmr'), expectedRevision: null },
    ]);

    expect(batch.results).toEqual([
      { ok: true, revision: 1 },
      { ok: true, revision: 1 },
    ]);
    const contacts = await store.listDigitalContacts(meta.projectId);
    expect(contacts).toHaveLength(2);
  });

  it('deleteDigitalContactsForProject clears the project partition', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const other = newProjectMeta('Other');
    await store.seedProject({ meta });
    await store.seedProject({ meta: other });
    await store.putDigitalContactsBatch([
      { row: newDigitalContact(meta.projectId, 'Alpha', 1, 'dmr'), expectedRevision: null },
      { row: newDigitalContact(meta.projectId, 'Bravo', 2, 'dmr'), expectedRevision: null },
      { row: newDigitalContact(other.projectId, 'Keep', 3, 'dmr'), expectedRevision: null },
    ]);

    const changes: PersistenceChange[] = [];
    const unsubscribe = store.subscribe((c) => changes.push(c));
    const result = await store.deleteDigitalContactsForProject(meta.projectId);
    unsubscribe();

    expect(result.deletedCount).toBe(2);
    expect(await store.listDigitalContacts(meta.projectId)).toHaveLength(0);
    expect(await store.listDigitalContacts(other.projectId)).toHaveLength(1);
    expect(changes).toEqual([
      { projectId: meta.projectId, kind: 'digitalContact', id: meta.projectId, op: 'delete' },
    ]);
  });

  it('delete project cascades all library and build rows', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Local');
    const tg = newTalkGroup(meta.projectId, 'World', 91);
    const { build, egressPaths } = newRadioBuildWithEgresses(meta.projectId, 'baofeng-dm1701');
    await store.seedProject({
      meta,
      channels: [channel],
      talkGroups: [tg],
      radioBuilds: [build],
      egressPaths,
    });

    await store.deleteEntity(meta.projectId, 'project', meta.id);

    expect(await store.loadProjectMeta(meta.projectId)).toBeNull();
    expect(await store.listChannels(meta.projectId)).toHaveLength(0);
    expect(await store.listTalkGroups(meta.projectId)).toHaveLength(0);
    expect(await store.listRadioBuilds(meta.projectId)).toHaveLength(0);
    expect(await store.listEgressPaths(meta.projectId)).toHaveLength(0);
  });
});

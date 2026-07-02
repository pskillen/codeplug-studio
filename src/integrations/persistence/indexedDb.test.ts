import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild, newProjectMeta, newTalkGroup } from '@core/domain/factories.ts';
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

  it('loadProjectSeed returns full aggregate including formatBuilds', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Local');
    const build = newFormatBuild(meta.projectId, 'opengd77-1701');
    await store.seedProject({ meta, channels: [channel], formatBuilds: [build] });

    const seed = await store.loadProjectSeed(meta.projectId);
    expect(seed?.meta.id).toBe(meta.id);
    expect(seed?.channels).toHaveLength(1);
    expect(seed?.formatBuilds).toHaveLength(1);
    expect(seed?.formatBuilds?.[0]?.id).toBe(build.id);
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

  it('delete project cascades all library and build rows', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Local');
    const tg = newTalkGroup(meta.projectId, 'World', 91);
    const build = newFormatBuild(meta.projectId, 'opengd77-1701');
    await store.seedProject({
      meta,
      channels: [channel],
      talkGroups: [tg],
      formatBuilds: [build],
    });

    await store.deleteEntity(meta.projectId, 'project', meta.id);

    expect(await store.loadProjectMeta(meta.projectId)).toBeNull();
    expect(await store.listChannels(meta.projectId)).toHaveLength(0);
    expect(await store.listTalkGroups(meta.projectId)).toHaveLength(0);
    expect(await store.listFormatBuilds(meta.projectId)).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import {
  newAprsConfiguration,
  newChannel,
  newDigitalContact,
  newFormatBuild,
  newProjectMeta,
  newTalkGroup,
} from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from './inMemory.ts';
import type { PersistenceChange } from './types.ts';

describe('InMemoryProjectPersistence', () => {
  it('lists seeded projects', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('North Wales');
    await store.seedProject({ meta });
    const list = await store.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('North Wales');
  });

  it('puts channel with revision bump', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Local');
    await store.seedProject({ meta, channels: [channel] });

    const result = await store.putChannel({ ...channel, name: 'Local updated' }, channel.revision);
    expect(result).toEqual({ ok: true, revision: 2 });

    const loaded = await store.getChannel(meta.projectId, channel.id);
    expect(loaded?.name).toBe('Local updated');
    expect(loaded?.revision).toBe(2);
  });

  it('rejects stale revision on put', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'A');
    await store.seedProject({ meta, channels: [channel] });

    await store.putChannel({ ...channel, name: 'B' }, 1);
    const conflict = await store.putChannel({ ...channel, name: 'C' }, 1);
    expect(conflict).toEqual({ ok: false, reason: 'revision_conflict' });
  });

  it('isolates channels per project', async () => {
    const store = new InMemoryProjectPersistence();
    const metaA = newProjectMeta('A');
    const metaB = newProjectMeta('B');
    const chA = newChannel(metaA.projectId, 'A-ch');
    const chB = newChannel(metaB.projectId, 'B-ch');
    await store.seedProject({ meta: metaA, channels: [chA] });
    await store.seedProject({ meta: metaB, channels: [chB] });

    expect(await store.getChannel(metaA.projectId, chA.id)).not.toBeNull();
    expect(await store.getChannel(metaA.projectId, chB.id)).toBeNull();
  });

  it('lists entities of one type for a project, sorted by name', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    await store.putChannel(newChannel(meta.projectId, 'Zulu'), null);
    await store.putChannel(newChannel(meta.projectId, 'Alpha'), null);
    await store.putTalkGroup(newTalkGroup(meta.projectId, 'TG', 1), null);

    const channels = await store.listChannels(meta.projectId);
    expect(channels.map((c) => c.name)).toEqual(['Alpha', 'Zulu']);
    expect(await store.listTalkGroups(meta.projectId)).toHaveLength(1);
  });

  it('notifies subscribers on put and delete', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    const channel = newChannel(meta.projectId, 'Local');

    const changes: PersistenceChange[] = [];
    const unsubscribe = store.subscribe((c) => changes.push(c));

    await store.putChannel(channel, null);
    await store.deleteEntity(meta.projectId, 'channel', channel.id);
    unsubscribe();
    await store.putChannel(newChannel(meta.projectId, 'After'), null);

    expect(changes).toEqual([
      { projectId: meta.projectId, kind: 'channel', id: channel.id, op: 'put' },
      { projectId: meta.projectId, kind: 'channel', id: channel.id, op: 'delete' },
    ]);
  });

  it('persists a single aprs configuration per project', async () => {
    const store = new InMemoryProjectPersistence();
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

  it('loadProjectSeed returns full aggregate including formatBuilds', async () => {
    const store = new InMemoryProjectPersistence();
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
    const store = new InMemoryProjectPersistence();
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

  it('putDigitalContactsBatch adds and updates in one notification', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    const existing = {
      ...newDigitalContact(meta.projectId, 'Existing', 100, 'dmr'),
      callsign: 'M0OLD',
    };
    await store.putDigitalContact(existing, null);

    const changes: PersistenceChange[] = [];
    const unsubscribe = store.subscribe((c) => changes.push(c));

    const added = newDigitalContact(meta.projectId, 'New', 200, 'dmr');
    const updated = { ...existing, city: 'London' };
    const batch = await store.putDigitalContactsBatch([
      { row: added, expectedRevision: null },
      { row: updated, expectedRevision: existing.revision },
    ]);

    unsubscribe();

    expect(batch.results).toEqual([
      { ok: true, revision: 1 },
      { ok: true, revision: 2 },
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      projectId: meta.projectId,
      kind: 'digitalContact',
      op: 'put',
    });

    const contacts = await store.listDigitalContacts(meta.projectId);
    expect(contacts).toHaveLength(2);
    expect(contacts.find((c) => c.digitalId === 200)?.name).toBe('New');
    expect(contacts.find((c) => c.digitalId === 100)?.city).toBe('London');
  });

  it('deleteDigitalContactsForProject clears only that project', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    const other = newProjectMeta('Other');
    await store.seedProject({ meta });
    await store.seedProject({ meta: other });
    await store.putDigitalContact(newDigitalContact(meta.projectId, 'Alpha', 1, 'dmr'), null);
    await store.putDigitalContact(newDigitalContact(meta.projectId, 'Bravo', 2, 'dmr'), null);
    await store.putDigitalContact(newDigitalContact(other.projectId, 'Keep', 3, 'dmr'), null);

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

  it('putDigitalContactsBatch continues after revision conflict on one item', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    const stale = newDigitalContact(meta.projectId, 'Stale', 300, 'dmr');
    await store.putDigitalContact(stale, null);
    await store.putDigitalContact({ ...stale, name: 'Bumped' }, stale.revision);
    const current = (await store.getDigitalContact(meta.projectId, stale.id))!;

    const added = newDigitalContact(meta.projectId, 'Fresh', 400, 'dmr');
    const batch = await store.putDigitalContactsBatch([
      { row: { ...stale, name: 'Conflict' }, expectedRevision: 1 },
      { row: added, expectedRevision: null },
    ]);

    expect(batch.results[0]).toEqual({ ok: false, reason: 'revision_conflict' });
    expect(batch.results[1]).toEqual({ ok: true, revision: 1 });
    expect(await store.listDigitalContacts(meta.projectId)).toHaveLength(2);
    expect(current.name).toBe('Bumped');
  });

  it('runWithoutNotifications emits once after nested writes', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    const changes: PersistenceChange[] = [];
    const unsubscribe = store.subscribe((c) => changes.push(c));

    await store.runWithoutNotifications(async () => {
      await store.putDigitalContactsBatch([
        { row: newDigitalContact(meta.projectId, 'One', 1, 'dmr'), expectedRevision: null },
        { row: newDigitalContact(meta.projectId, 'Two', 2, 'dmr'), expectedRevision: null },
      ]);
      await store.putChannel(newChannel(meta.projectId, 'Ch'), null);
    });

    unsubscribe();

    expect(changes).toEqual([
      { projectId: meta.projectId, kind: 'project', id: meta.projectId, op: 'put' },
    ]);
  });

  it('delete project cascades all library and build rows', async () => {
    const store = new InMemoryProjectPersistence();
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

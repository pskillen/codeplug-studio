import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { newChannel, newProjectMeta } from '@core/domain/factories.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { IndexedDbProjectPersistence } from './indexedDb.ts';
import { InMemoryProjectPersistence } from './inMemory.ts';
import type { DirectoryPersistenceChange, ProjectPersistence } from './types.ts';

let idbCounter = 0;
const openIdb = new Set<IndexedDbProjectPersistence>();

function sampleEntry(projectId: string, digitalId: number, name: string): DigitalIdDirectoryEntry {
  return {
    projectId,
    digitalId,
    mode: 'dmr',
    name,
    callsign: 'CALL',
    city: 'City',
    state: 'ST',
    country: 'Country',
  };
}

type StoreFactory = () => ProjectPersistence;

const implementations: [string, StoreFactory][] = [
  ['InMemory', () => new InMemoryProjectPersistence()],
  [
    'IndexedDb',
    () => {
      const store = new IndexedDbProjectPersistence(`dir-test-${idbCounter++}`);
      openIdb.add(store);
      return store;
    },
  ],
];

afterEach(() => {
  for (const store of openIdb) store.close();
  openIdb.clear();
});

describe.each(implementations)('DigitalIdDirectory — %s', (_label, makeStore) => {
  it('batch upserts and replaces rows by digitalId', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    const first = sampleEntry(meta.projectId, 1234567, 'Alpha');
    const second = sampleEntry(meta.projectId, 7654321, 'Bravo');
    const result = await store.putDigitalIdDirectoryEntriesBatch([first, second]);
    expect(result).toEqual({ written: 2 });
    expect(await store.countDigitalIdDirectoryEntries(meta.projectId)).toBe(2);

    const updated = { ...first, name: 'Alpha updated', city: 'New City' };
    await store.putDigitalIdDirectoryEntriesBatch([updated]);
    const loaded = await store.getDigitalIdDirectoryEntry(meta.projectId, 1234567);
    expect(loaded).toMatchObject({ name: 'Alpha updated', city: 'New City' });
    expect(await store.countDigitalIdDirectoryEntries(meta.projectId)).toBe(2);
  });

  it('lists entries sorted by name', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 2, 'Zulu'),
      sampleEntry(meta.projectId, 1, 'Alpha'),
    ]);

    const names = (await store.listDigitalIdDirectoryEntries(meta.projectId)).map((e) => e.name);
    expect(names).toEqual(['Alpha', 'Zulu']);
  });

  it('clears only the requested project partition', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const other = newProjectMeta('Other');
    await store.seedProject({ meta });
    await store.seedProject({ meta: other });

    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 1, 'One'),
      sampleEntry(meta.projectId, 2, 'Two'),
      sampleEntry(other.projectId, 3, 'Keep'),
    ]);

    const result = await store.deleteDigitalIdDirectoryForProject(meta.projectId);
    expect(result.deletedCount).toBe(2);
    expect(await store.countDigitalIdDirectoryEntries(meta.projectId)).toBe(0);
    expect(await store.countDigitalIdDirectoryEntries(other.projectId)).toBe(1);
  });

  it('survives replaceProject with an empty library seed', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Old');
    await store.seedProject({ meta, channels: [channel] });
    await store.putDigitalIdDirectoryEntriesBatch([sampleEntry(meta.projectId, 99, 'Shadow')]);

    await store.replaceProject(meta.projectId, { meta });

    expect(await store.countDigitalIdDirectoryEntries(meta.projectId)).toBe(1);
    expect(await store.getDigitalIdDirectoryEntry(meta.projectId, 99)).toMatchObject({
      name: 'Shadow',
    });
    expect(await store.listChannels(meta.projectId)).toHaveLength(0);
  });

  it('does not include directory rows on loadProjectSeed', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([sampleEntry(meta.projectId, 42, 'Dir')]);

    const seed = await store.loadProjectSeed(meta.projectId);
    expect(seed).not.toBeNull();
    expect(seed).not.toHaveProperty('digitalIdDirectory');
    expect(seed?.digitalContacts).toEqual([]);
  });

  it('notifies directory subscribers without polluting library subscribe', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    const directoryChanges: DirectoryPersistenceChange[] = [];
    const libraryChanges: unknown[] = [];
    const unsubDir = store.subscribeDirectory((c) => directoryChanges.push(c));
    const unsubLib = store.subscribe((c) => libraryChanges.push(c));

    await store.putDigitalIdDirectoryEntriesBatch([sampleEntry(meta.projectId, 7, 'Notify')]);
    await store.deleteDigitalIdDirectoryForProject(meta.projectId);

    unsubDir();
    unsubLib();

    expect(directoryChanges).toEqual([
      { projectId: meta.projectId, digitalId: 7, op: 'put' },
      { projectId: meta.projectId, digitalId: 0, op: 'delete' },
    ]);
    expect(libraryChanges).toHaveLength(0);
  });
});

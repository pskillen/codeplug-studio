import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { newChannel, newProjectMeta } from '@core/domain/factories.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { IndexedDbProjectPersistence } from './indexedDb.ts';
import { InMemoryProjectPersistence } from './inMemory.ts';
import type { DirectoryPersistenceChange, ProjectPersistence } from './types.ts';

let idbCounter = 0;
const openIdb = new Set<IndexedDbProjectPersistence>();

function sampleEntry(
  projectId: string,
  digitalId: number,
  overrides: Partial<Pick<DigitalIdDirectoryEntry, 'name' | 'callsign' | 'country'>> = {},
): DigitalIdDirectoryEntry {
  return {
    projectId,
    digitalId,
    mode: 'dmr',
    name: overrides.name ?? `Name ${digitalId}`,
    callsign: overrides.callsign ?? 'CALL',
    city: 'City',
    state: 'ST',
    country: overrides.country ?? 'Country',
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

    const result = await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 1234567, { name: 'Alpha' }),
      sampleEntry(meta.projectId, 7654321, { name: 'Bravo' }),
    ]);
    expect(result).toEqual({ written: 2 });
    expect(await store.countDigitalIdDirectoryEntries(meta.projectId)).toBe(2);

    const updated = {
      ...sampleEntry(meta.projectId, 1234567, { name: 'Alpha updated' }),
      city: 'New City',
    };
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
      sampleEntry(meta.projectId, 2, { name: 'Zulu' }),
      sampleEntry(meta.projectId, 1, { name: 'Alpha' }),
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
      sampleEntry(meta.projectId, 1, { name: 'One' }),
      sampleEntry(meta.projectId, 2, { name: 'Two' }),
      sampleEntry(other.projectId, 3, { name: 'Keep' }),
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
    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 99, { name: 'Shadow' }),
    ]);

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

    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 7, { name: 'Notify' }),
    ]);
    await store.deleteDigitalIdDirectoryForProject(meta.projectId);

    unsubDir();
    unsubLib();

    expect(directoryChanges).toEqual([
      { projectId: meta.projectId, digitalId: 7, op: 'put' },
      { projectId: meta.projectId, digitalId: 0, op: 'delete' },
    ]);
    expect(libraryChanges).toHaveLength(0);
  });

  it('deletes only rows matching directory filters', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Filtered delete');
    await store.seedProject({ meta });

    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 3109478, { country: 'Scotland', name: 'Highland' }),
      sampleEntry(meta.projectId, 3109000, { country: 'Scotland', name: 'Lowland' }),
      sampleEntry(meta.projectId, 9999999, { country: 'England', name: 'Other' }),
    ]);

    const result = await store.deleteDigitalIdDirectoryMatching({
      projectId: meta.projectId,
      countryEquals: 'Scotland',
    });
    expect(result.deletedCount).toBe(2);
    expect(await store.countDigitalIdDirectoryEntries(meta.projectId)).toBe(1);

    const remaining = await store.getDigitalIdDirectoryEntry(meta.projectId, 9999999);
    expect(remaining?.country).toBe('England');
  });

  it('deletes by digital ID prefix filter', async () => {
    const store = makeStore();
    const meta = newProjectMeta('ID delete');
    await store.seedProject({ meta });

    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 3109478, { name: 'A' }),
      sampleEntry(meta.projectId, 3109000, { name: 'B' }),
      sampleEntry(meta.projectId, 9999999, { name: 'C' }),
    ]);

    const result = await store.deleteDigitalIdDirectoryMatching({
      projectId: meta.projectId,
      digitalIdPrefix: '3109',
    });
    expect(result.deletedCount).toBe(2);
    expect(await store.countDigitalIdDirectoryEntries(meta.projectId)).toBe(1);
  });
});

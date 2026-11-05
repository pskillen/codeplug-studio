import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('lists entries in Digital ID order', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 2, { name: 'Alpha' }),
      sampleEntry(meta.projectId, 10, { name: 'Bravo' }),
      sampleEntry(meta.projectId, 1, { name: 'Zulu' }),
    ]);

    const ids = (await store.listDigitalIdDirectoryEntries(meta.projectId)).map((e) => e.digitalId);
    expect(ids).toEqual([1, 2, 10]);
  });

  it('reads primary-key batches by keyset and never leaks another project or index fields', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const other = newProjectMeta('Other');
    await store.seedProject({ meta });
    await store.seedProject({ meta: other });
    await store.putDigitalIdDirectoryEntriesBatch(
      [7, 3, 9, 1, 5].map((id) => sampleEntry(meta.projectId, id)),
    );
    await store.putDigitalIdDirectoryEntriesBatch([sampleEntry(other.projectId, 4)]);

    const first = await store.readDigitalIdDirectoryBatch(meta.projectId, { limit: 2 });
    expect(first.map((r) => r.digitalId)).toEqual([1, 3]);
    expect(Object.keys(first[0]!)).not.toContain('nameLower');

    const second = await store.readDigitalIdDirectoryBatch(meta.projectId, {
      afterDigitalId: 3,
      limit: 2,
    });
    expect(second.map((r) => r.digitalId)).toEqual([5, 7]);

    const rest = await store.readDigitalIdDirectoryBatch(meta.projectId, {
      afterDigitalId: 7,
      limit: 10,
    });
    expect(rest.map((r) => r.digitalId)).toEqual([9]);
    expect(
      await store.readDigitalIdDirectoryBatch(meta.projectId, { afterDigitalId: 9, limit: 10 }),
    ).toEqual([]);
  });

  it('streams the partition across batch boundaries, including after later writes', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch(
      [5, 1, 4].map((id) => sampleEntry(meta.projectId, id)),
    );
    await store.readDigitalIdDirectoryBatch(meta.projectId, { limit: 1 });
    await store.putDigitalIdDirectoryEntriesBatch(
      [3, 2, 6].map((id) => sampleEntry(meta.projectId, id)),
    );

    const seen: number[] = [];
    await store.iterateDigitalIdDirectory(meta.projectId, (row) => void seen.push(row.digitalId), {
      batchSize: 2,
    });
    expect(seen).toEqual([1, 2, 3, 4, 5, 6]);
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
    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 42, { name: 'Dir' }),
    ]);

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

  it('looks up directory rows by digital ID without listing the partition', async () => {
    const store = makeStore();
    const meta = newProjectMeta('By ids');
    await store.seedProject({ meta });

    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 1, { name: 'One' }),
      sampleEntry(meta.projectId, 2, { name: 'Two' }),
      sampleEntry(meta.projectId, 3, { name: 'Three' }),
    ]);

    const found = await store.getDigitalIdDirectoryEntriesByIds(meta.projectId, [3, 99, 1]);
    expect(found.map((row) => row.digitalId).sort((a, b) => a - b)).toEqual([1, 3]);
    expect(await store.getDigitalIdDirectoryEntriesByIds(meta.projectId, [])).toEqual([]);
  });

  it('coalesces directory notifications inside runWithoutNotifications', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Coalesce');
    await store.seedProject({ meta });

    const directoryChanges: DirectoryPersistenceChange[] = [];
    const unsubDir = store.subscribeDirectory((c) => directoryChanges.push(c));

    await store.runWithoutNotifications(async () => {
      await store.putDigitalIdDirectoryEntriesBatch([sampleEntry(meta.projectId, 1)]);
      await store.putDigitalIdDirectoryEntriesBatch([sampleEntry(meta.projectId, 2)]);
    });

    unsubDir();
    expect(directoryChanges).toEqual([{ projectId: meta.projectId, digitalId: 2, op: 'put' }]);
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

  it('deletes the directory with its project and never touches another project', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Doomed');
    const other = newProjectMeta('Survivor');
    await store.seedProject({ meta });
    await store.seedProject({ meta: other });
    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 1),
      sampleEntry(meta.projectId, 2),
    ]);
    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(other.projectId, 1),
      sampleEntry(other.projectId, 3),
    ]);
    const seen: DirectoryPersistenceChange[] = [];
    store.subscribeDirectory((change) => seen.push(change));

    await store.deleteEntity(meta.projectId, 'project', meta.projectId);

    expect(await store.countDigitalIdDirectoryEntries(meta.projectId)).toBe(0);
    expect(await store.loadProjectMeta(meta.projectId)).toBeNull();
    expect(await store.countDigitalIdDirectoryEntries(other.projectId)).toBe(2);
    expect(
      (await store.listDigitalIdDirectoryEntries(other.projectId)).map((r) => r.digitalId),
    ).toEqual([1, 3]);
    expect(seen).toContainEqual({ projectId: meta.projectId, digitalId: 0, op: 'delete' });
  });

  it('range-deletes one project without touching a project whose ID shares its prefix', async () => {
    const store = makeStore();
    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry('p1', 5),
      sampleEntry('p1', 6),
      sampleEntry('p10', 5),
      sampleEntry('p', 5),
      sampleEntry('p2', 5),
    ]);

    expect(await store.deleteDigitalIdDirectoryForProject('p1')).toEqual({ deletedCount: 2 });

    for (const projectId of ['p10', 'p', 'p2']) {
      expect(await store.countDigitalIdDirectoryEntries(projectId)).toBe(1);
    }
    expect(await store.countDigitalIdDirectoryEntries('p1')).toBe(0);
    expect(await store.deleteDigitalIdDirectoryForProject('p1')).toEqual({ deletedCount: 0 });
  });

  it('a filtered delete removes only the matches of its own project', async () => {
    const store = makeStore();
    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry('p1', 1, { country: 'Scotland' }),
      sampleEntry('p1', 2, { country: 'England' }),
    ]);
    await store.putDigitalIdDirectoryEntriesBatch([sampleEntry('p2', 1, { country: 'Scotland' })]);

    const result = await store.deleteDigitalIdDirectoryMatching({
      projectId: 'p1',
      countryEquals: 'Scotland',
    });

    expect(result.deletedCount).toBe(1);
    expect(await store.countDigitalIdDirectoryEntries('p1')).toBe(1);
    expect(await store.countDigitalIdDirectoryEntries('p2')).toBe(1);
  });
});

describe('IndexedDb orphan directory sweep', () => {
  it('removes rows whose project is gone and keeps every row of every existing project', async () => {
    const dbName = `dir-sweep-${idbCounter++}`;
    const first = new IndexedDbProjectPersistence(dbName);
    openIdb.add(first);
    const a = newProjectMeta('A');
    const b = newProjectMeta('B');
    await first.seedProject({ meta: a });
    await first.seedProject({ meta: b });
    await first.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(a.projectId, 1),
      sampleEntry(a.projectId, 2),
      sampleEntry(a.projectId, 3),
    ]);
    await first.putDigitalIdDirectoryEntriesBatch([sampleEntry(b.projectId, 1)]);
    await first.putDigitalIdDirectoryEntriesBatch([
      sampleEntry('gone-1', 1),
      sampleEntry('gone-1', 2),
      sampleEntry('gone-2', 7),
    ]);
    // A project whose ID prefixes an orphan's, and the reverse.
    await first.putDigitalIdDirectoryEntriesBatch([sampleEntry(`${a.projectId}-x`, 9)]);

    expect(await first.sweepOrphanDirectoryRows()).toBe(3);

    expect(await first.countDigitalIdDirectoryEntries(a.projectId)).toBe(3);
    expect(await first.countDigitalIdDirectoryEntries(b.projectId)).toBe(1);
    expect(await first.countDigitalIdDirectoryEntries('gone-1')).toBe(0);
    expect(await first.countDigitalIdDirectoryEntries('gone-2')).toBe(0);
    expect(await first.countDigitalIdDirectoryEntries(`${a.projectId}-x`)).toBe(0);
    // Nothing left to sweep, and a second run changes nothing.
    expect(await first.sweepOrphanDirectoryRows()).toBe(0);
    expect(await first.countDigitalIdDirectoryEntries(a.projectId)).toBe(3);
  });

  it('runs when the database is opened', async () => {
    const dbName = `dir-sweep-${idbCounter++}`;
    const first = new IndexedDbProjectPersistence(dbName);
    openIdb.add(first);
    const keep = newProjectMeta('Keep');
    await first.seedProject({ meta: keep });
    await first.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(keep.projectId, 1),
      sampleEntry('orphan', 1),
    ]);

    const second = new IndexedDbProjectPersistence(dbName);
    openIdb.add(second);

    // The sweep runs in the background after open, so wait for it.
    await vi.waitFor(async () =>
      expect(await second.countDigitalIdDirectoryEntries('orphan')).toBe(0),
    );
    expect(await second.countDigitalIdDirectoryEntries(keep.projectId)).toBe(1);
  });

  it('with no projects at all, every directory row is an orphan and is deleted', async () => {
    const store = new IndexedDbProjectPersistence(`dir-sweep-${idbCounter++}`);
    openIdb.add(store);
    expect(await store.sweepOrphanDirectoryRows()).toBe(0);
    await store.putDigitalIdDirectoryEntriesBatch([sampleEntry('x', 1), sampleEntry('y', 2)]);
    expect(await store.sweepOrphanDirectoryRows()).toBe(2);
    expect(await store.countDigitalIdDirectoryEntries('x')).toBe(0);
    expect(await store.countDigitalIdDirectoryEntries('y')).toBe(0);
  });

  it('deletes an orphan larger than one chunk completely, and nothing else', async () => {
    const store = new IndexedDbProjectPersistence(`dir-sweep-${idbCounter++}`);
    openIdb.add(store);
    const keep = newProjectMeta('Keep');
    await store.seedProject({ meta: keep });
    await store.putDigitalIdDirectoryEntriesBatch([sampleEntry(keep.projectId, 1)]);
    const many = Array.from({ length: 5001 }, (_, i) => sampleEntry('big', i + 1));
    for (let i = 0; i < many.length; i += 2000) {
      await store.putDigitalIdDirectoryEntriesBatch(many.slice(i, i + 2000));
    }
    expect(await store.sweepOrphanDirectoryRows()).toBe(1);
    expect(await store.countDigitalIdDirectoryEntries('big')).toBe(0);
    expect(await store.countDigitalIdDirectoryEntries(keep.projectId)).toBe(1);
  }, 60_000);

  it('does not sweep a project created on a second connection while the sweep runs', async () => {
    const dbName = `dir-sweep-${idbCounter++}`;
    const a = new IndexedDbProjectPersistence(dbName);
    const b = new IndexedDbProjectPersistence(dbName);
    openIdb.add(a);
    openIdb.add(b);
    await a.countDigitalIdDirectoryEntries('warm');
    await b.countDigitalIdDirectoryEntries('warm');
    const meta = newProjectMeta('Late');
    // Orphan rows give the sweep work; B creates its project and directory in the meantime.
    await a.putDigitalIdDirectoryEntriesBatch([sampleEntry('old-orphan', 1)]);
    const sweep = a.sweepOrphanDirectoryRows();
    await b.seedProject({ meta });
    await b.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 1),
      sampleEntry(meta.projectId, 2),
    ]);
    await sweep;
    await a.sweepOrphanDirectoryRows();
    expect(await b.countDigitalIdDirectoryEntries(meta.projectId)).toBe(2);
    expect(await b.countDigitalIdDirectoryEntries('old-orphan')).toBe(0);
  });

  it('keeps a project row that has no directory rows yet, and the rows written after it', async () => {
    const store = new IndexedDbProjectPersistence(`dir-sweep-${idbCounter++}`);
    openIdb.add(store);
    const meta = newProjectMeta('Row first');
    await store.seedProject({ meta });
    expect(await store.sweepOrphanDirectoryRows()).toBe(0);
    await store.putDigitalIdDirectoryEntriesBatch([sampleEntry(meta.projectId, 1)]);
    expect(await store.sweepOrphanDirectoryRows()).toBe(0);
    expect(await store.countDigitalIdDirectoryEntries(meta.projectId)).toBe(1);
  });

  it('an aborted project delete leaves the project and its directory rows', async () => {
    const store = new IndexedDbProjectPersistence(`dir-sweep-${idbCounter++}`);
    openIdb.add(store);
    const meta = newProjectMeta('Abort');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 1),
      sampleEntry(meta.projectId, 2),
    ]);
    const original = IDBObjectStore.prototype.delete;
    let aborted = false;
    IDBObjectStore.prototype.delete = function (this: IDBObjectStore, ...args) {
      const result = original.apply(this, args);
      if (!aborted) {
        aborted = true;
        this.transaction.abort();
      }
      return result;
    };
    try {
      await expect(
        store.deleteEntity(meta.projectId, 'project', meta.projectId),
      ).rejects.toBeDefined();
    } finally {
      IDBObjectStore.prototype.delete = original;
    }
    expect(aborted).toBe(true);
    expect(await store.loadProjectMeta(meta.projectId)).not.toBeNull();
    expect(await store.countDigitalIdDirectoryEntries(meta.projectId)).toBe(2);
  });

  it('replaceProject keeps the project directory rows across a reopen', async () => {
    const dbName = `dir-sweep-${idbCounter++}`;
    const first = new IndexedDbProjectPersistence(dbName);
    openIdb.add(first);
    const meta = newProjectMeta('Replace');
    await first.seedProject({ meta });
    await first.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(meta.projectId, 1),
      sampleEntry(meta.projectId, 2),
    ]);
    await first.replaceProject(meta.projectId, { meta: { ...meta, name: 'Replaced' } });
    expect(await first.countDigitalIdDirectoryEntries(meta.projectId)).toBe(2);
    first.close();

    const second = new IndexedDbProjectPersistence(dbName);
    openIdb.add(second);
    expect(await second.sweepOrphanDirectoryRows()).toBe(0);
    expect(await second.countDigitalIdDirectoryEntries(meta.projectId)).toBe(2);
  });
});

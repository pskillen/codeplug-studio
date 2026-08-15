import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { IndexedDbProjectPersistence } from './indexedDb.ts';
import { InMemoryProjectPersistence } from './inMemory.ts';
import type { ProjectPersistence } from './types.ts';

let idbCounter = 0;
const openIdb = new Set<IndexedDbProjectPersistence>();

function makeEntry(
  projectId: string,
  digitalId: number,
  overrides: Partial<Pick<DigitalIdDirectoryEntry, 'name' | 'callsign' | 'country' | 'city'>> = {},
): DigitalIdDirectoryEntry {
  return {
    projectId,
    digitalId,
    mode: 'dmr',
    name: overrides.name ?? `Name ${digitalId}`,
    callsign: overrides.callsign ?? `M0TEST${digitalId}`,
    city: overrides.city ?? 'City',
    state: 'ST',
    country: overrides.country ?? 'England',
  };
}

async function seedMany(
  store: ProjectPersistence,
  projectId: string,
  count: number,
): Promise<void> {
  const batchSize = 250;
  for (let offset = 0; offset < count; offset += batchSize) {
    const entries: DigitalIdDirectoryEntry[] = [];
    for (let i = offset; i < Math.min(offset + batchSize, count); i += 1) {
      entries.push(
        makeEntry(projectId, 1_000_000 + i, {
          name: `Contact ${String(i).padStart(5, '0')}`,
          callsign: `M0${String(i).padStart(4, '0')}`,
          country: i % 3 === 0 ? 'Scotland' : 'England',
        }),
      );
    }
    await store.putDigitalIdDirectoryEntriesBatch(entries);
  }
}

type StoreFactory = () => ProjectPersistence;

const implementations: [string, StoreFactory][] = [
  ['InMemory', () => new InMemoryProjectPersistence()],
  [
    'IndexedDb',
    () => {
      const store = new IndexedDbProjectPersistence(`dir-page-test-${idbCounter++}`);
      openIdb.add(store);
      return store;
    },
  ],
];

afterEach(() => {
  for (const store of openIdb) store.close();
  openIdb.clear();
});

describe.each(implementations)('DigitalIdDirectory paged queries — %s', (_label, makeStore) => {
  it('returns page boundaries and total for ~1k rows', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Paged');
    await store.seedProject({ meta });
    await seedMany(store, meta.projectId, 1_000);

    const first = await store.queryDigitalIdDirectoryPage({
      projectId: meta.projectId,
      offset: 0,
      limit: 50,
      orderBy: 'name',
    });
    expect(first.total).toBe(1_000);
    expect(first.rows).toHaveLength(50);
    expect(first.rows[0]?.name).toBe('Contact 00000');

    const middle = await store.queryDigitalIdDirectoryPage({
      projectId: meta.projectId,
      offset: 500,
      limit: 25,
      orderBy: 'name',
    });
    expect(middle.total).toBe(1_000);
    expect(middle.rows).toHaveLength(25);
    expect(middle.rows[0]?.name).toBe('Contact 00500');
  });

  it('filters by callsign prefix without hydrating the full partition', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Prefix');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      makeEntry(meta.projectId, 1, { callsign: 'G4ABC', name: 'Alpha' }),
      makeEntry(meta.projectId, 2, { callsign: 'G4ABD', name: 'Bravo' }),
      makeEntry(meta.projectId, 3, { callsign: 'M0XYZ', name: 'Charlie' }),
    ]);

    const page = await store.queryDigitalIdDirectoryPage({
      projectId: meta.projectId,
      offset: 0,
      limit: 10,
      orderBy: 'callsign',
      callsignPrefix: 'G4AB',
    });

    expect(page.total).toBe(2);
    expect(page.rows.map((row) => row.callsign)).toEqual(['G4ABC', 'G4ABD']);
  });

  it('filters callsign prefix case-insensitively', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Case callsign');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      makeEntry(meta.projectId, 1, { callsign: 'G4ABC', name: 'Alpha' }),
      makeEntry(meta.projectId, 2, { callsign: 'M0XYZ', name: 'Charlie' }),
    ]);

    const page = await store.queryDigitalIdDirectoryPage({
      projectId: meta.projectId,
      offset: 0,
      limit: 10,
      orderBy: 'callsign',
      callsignPrefix: 'g4',
    });

    expect(page.total).toBe(1);
    expect(page.rows[0]?.callsign).toBe('G4ABC');
  });

  it('filters name prefix case-insensitively', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Case name');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      makeEntry(meta.projectId, 1, { name: 'Alpha One', callsign: 'A1' }),
      makeEntry(meta.projectId, 2, { name: 'Bravo', callsign: 'B1' }),
    ]);

    const page = await store.queryDigitalIdDirectoryPage({
      projectId: meta.projectId,
      offset: 0,
      limit: 10,
      namePrefix: 'alpha',
    });

    expect(page.total).toBe(1);
    expect(page.rows[0]?.name).toBe('Alpha One');
  });

  it('filters by digital ID decimal prefix', async () => {
    const store = makeStore();
    const meta = newProjectMeta('ID prefix');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      makeEntry(meta.projectId, 3109478, { callsign: 'W1AW', name: 'Hiram' }),
      makeEntry(meta.projectId, 3109000, { callsign: 'M7ABC', name: 'Other' }),
      makeEntry(meta.projectId, 9999999, { callsign: 'M0XYZ', name: 'Far' }),
    ]);

    const page = await store.queryDigitalIdDirectoryPage({
      projectId: meta.projectId,
      offset: 0,
      limit: 10,
      orderBy: 'digitalId',
      digitalIdPrefix: '3109',
    });

    expect(page.total).toBe(2);
    expect(page.rows.map((row) => row.digitalId)).toEqual([3109000, 3109478]);
  });

  it('filters by name prefix', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Name prefix');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      makeEntry(meta.projectId, 1, { name: 'Alpha One', callsign: 'A1' }),
      makeEntry(meta.projectId, 2, { name: 'Alpha Two', callsign: 'A2' }),
      makeEntry(meta.projectId, 3, { name: 'Bravo', callsign: 'B1' }),
    ]);

    const page = await store.queryDigitalIdDirectoryPage({
      projectId: meta.projectId,
      offset: 0,
      limit: 10,
      namePrefix: 'Alpha',
    });

    expect(page.total).toBe(2);
    expect(page.rows.map((row) => row.name)).toEqual(['Alpha One', 'Alpha Two']);
  });

  it('filters by country', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Country');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      makeEntry(meta.projectId, 1, { country: 'Scotland', name: 'Highland' }),
      makeEntry(meta.projectId, 2, { country: 'England', name: 'Lowland' }),
      makeEntry(meta.projectId, 3, { country: 'Scotland', name: 'Isles' }),
    ]);

    const page = await store.queryDigitalIdDirectoryPage({
      projectId: meta.projectId,
      offset: 0,
      limit: 10,
      countryEquals: 'Scotland',
      orderBy: 'name',
    });

    expect(page.total).toBe(2);
    expect(page.rows.map((row) => row.name)).toEqual(['Highland', 'Isles']);
  });

  it('sorts by digitalId', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Digital ID sort');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      makeEntry(meta.projectId, 300, { name: 'Late' }),
      makeEntry(meta.projectId, 100, { name: 'Early' }),
    ]);

    const page = await store.queryDigitalIdDirectoryPage({
      projectId: meta.projectId,
      offset: 0,
      limit: 10,
      orderBy: 'digitalId',
    });

    expect(page.rows.map((row) => row.digitalId)).toEqual([100, 300]);
  });

  it('walks rows with iterateDigitalIdDirectory', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Iterate');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      makeEntry(meta.projectId, 2, { name: 'Zulu' }),
      makeEntry(meta.projectId, 1, { name: 'Alpha' }),
    ]);

    const names: string[] = [];
    await store.iterateDigitalIdDirectory(meta.projectId, (row) => {
      names.push(row.name);
    });

    expect(names).toEqual(['Alpha', 'Zulu']);
  });
});

describe('DigitalIdDirectory indexes — IndexedDb', () => {
  it('creates search indexes on upgrade from schema v27 layout', async () => {
    const dbName = `dir-index-upgrade-${idbCounter++}`;
    const projectId = 'upgrade-project';

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(dbName, 27);
      req.onupgradeneeded = () => {
        const db = req.result;
        const os = db.createObjectStore('digitalIdDirectory', {
          keyPath: ['projectId', 'digitalId'],
        });
        os.createIndex('byProject', 'projectId', { unique: false });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('digitalIdDirectory', 'readwrite');
        tx.objectStore('digitalIdDirectory').put(makeEntry(projectId, 1));
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const upgraded = new IndexedDbProjectPersistence(dbName);
    await upgraded.queryDigitalIdDirectoryPage({
      projectId,
      offset: 0,
      limit: 1,
      callsignPrefix: 'M0',
    });
    upgraded.close();

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const os = db.transaction('digitalIdDirectory', 'readonly').objectStore('digitalIdDirectory');
    expect([...os.indexNames].sort()).toEqual([
      'byProject',
      'byProjectCallsign',
      'byProjectCallsignLower',
      'byProjectCountry',
      'byProjectDigitalIdStr',
      'byProjectName',
      'byProjectNameLower',
    ]);
    db.close();
  });
});

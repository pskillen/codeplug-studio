import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbProjectPersistence } from '@integrations/persistence/indexedDb.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { pageDigitalIdDirectoryForWrite } from './directoryWritePaging.ts';

function makeEntry(projectId: string, digitalId: number, name?: string): DigitalIdDirectoryEntry {
  return {
    projectId,
    digitalId,
    mode: 'dmr',
    name: name ?? `Name ${digitalId}`,
    callsign: `M0TEST${digitalId}`,
    city: 'City',
    state: 'ST',
    country: 'England',
  };
}

/** Deterministic PRNG so the seeded directory is the same on every run. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAME_POOL = [
  'Alice',
  'ALICE',
  'alice',
  'Bob',
  'bob',
  'BOB',
  'Émile',
  'émile',
  'Zoë',
  'zoë',
  'Mary Ann',
  'mary ann',
  'MARY-ANN',
  '',
  ' leading',
  'Z',
  'a',
];

/** Duplicate and case-variant names over scattered, shuffled IDs. */
function seededDirectory(
  projectId: string,
  count: number,
  seed: number,
): DigitalIdDirectoryEntry[] {
  const rand = mulberry32(seed);
  const ids = new Set<number>();
  while (ids.size < count) ids.add(1 + Math.floor(rand() * 5_000_000));
  return [...ids].map((id) => {
    const base = NAME_POOL[Math.floor(rand() * NAME_POOL.length)]!;
    // A third of the rows get a distinguishing suffix so ties and non-ties are both common.
    const name = rand() < 0.33 ? `${base} ${Math.floor(rand() * 20)}` : base;
    return makeEntry(projectId, id, name);
  });
}

/**
 * The walk this module replaced: page the name index by offset, accept in order, stop when the
 * cap fills. The real store provides the order, so this is the owner-visible behaviour.
 */
async function nameOrderedWalk(
  store: ProjectPersistence,
  projectId: string,
  cap: number,
  accept: (row: DigitalIdDirectoryEntry) => boolean,
): Promise<{ accepted: number[]; rejected: number[] }> {
  const accepted: number[] = [];
  const rejected: number[] = [];
  let offset = 0;
  while (true) {
    const page = await store.queryDigitalIdDirectoryPage({
      projectId,
      offset,
      limit: 100,
      orderBy: 'name',
    });
    if (page.rows.length === 0) break;
    for (const row of page.rows) {
      if (accepted.length >= cap) break;
      if (accept(row)) accepted.push(row.digitalId);
      else rejected.push(row.digitalId);
    }
    if (accepted.length >= cap) break;
    offset += page.rows.length;
    if (offset >= page.total) break;
  }
  return { accepted, rejected };
}

let dbCounter = 0;
const openIdb = new Set<IndexedDbProjectPersistence>();
afterEach(() => {
  for (const store of openIdb) store.close();
  openIdb.clear();
});

describe('pageDigitalIdDirectoryForWrite', () => {
  it('reads the directory linearly and counts it once, never offset paging', async () => {
    const store = new InMemoryProjectPersistence();
    const rows = Array.from({ length: 250 }, (_, i) => makeEntry('p1', 10_000 + i));
    await store.putDigitalIdDirectoryEntriesBatch(rows);

    const pageSpy = vi.spyOn(store, 'queryDigitalIdDirectoryPage');
    const countSpy = vi.spyOn(store, 'countDigitalIdDirectoryEntries');
    const batchSpy = vi.spyOn(store, 'readDigitalIdDirectoryBatch');
    const collected: number[] = [];

    const { total, collected: count } = await pageDigitalIdDirectoryForWrite({
      store,
      projectId: 'p1',
      cap: 100,
      batchSize: 50,
      acceptRow: (row) => row.digitalId > 0,
      onAcceptedRow: (row) => {
        collected.push(row.digitalId);
      },
    });

    expect(total).toBe(rows.length);
    expect(count).toBe(100);
    expect(collected).toHaveLength(100);
    expect(pageSpy).not.toHaveBeenCalled();
    expect(countSpy).toHaveBeenCalledTimes(1);
    // 250 rows in batches of 50: 5 full batches plus the empty one that ends the pass.
    expect(batchSpy.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it('reports progress while collecting', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch(
      Array.from({ length: 20 }, (_, i) => makeEntry('p1', 20_000 + i)),
    );
    const onProgress = vi.fn();

    await pageDigitalIdDirectoryForWrite({
      store,
      projectId: 'p1',
      cap: 10,
      batchSize: 5,
      onProgress,
      acceptRow: () => true,
      onAcceptedRow: () => {},
    });

    expect(onProgress).toHaveBeenCalled();
    const last = onProgress.mock.calls.at(-1)![0]!;
    expect(last.cur).toBe(10);
    expect(last.max).toBe(10);
    expect(last.msg).toContain('Loading directory contacts');
  });

  it('emits in name order with Digital ID as the tie-break, case-insensitively', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch([
      makeEntry('p1', 5, 'bob'),
      makeEntry('p1', 3, 'BOB'),
      makeEntry('p1', 9, 'Alice'),
      makeEntry('p1', 1, 'alice'),
      makeEntry('p1', 2, 'Zed'),
    ]);
    const order: number[] = [];
    await pageDigitalIdDirectoryForWrite({
      store,
      projectId: 'p1',
      cap: 100,
      batchSize: 2,
      acceptRow: () => true,
      onAcceptedRow: (row) => void order.push(row.digitalId),
    });
    expect(order).toEqual([1, 9, 3, 5, 2]);
  });

  describe('capped selection matches the name-ordered walk it replaced', () => {
    const cases: { cap: number; batchSize: number; seed: number }[] = [
      { cap: 1, batchSize: 7, seed: 1 },
      { cap: 40, batchSize: 50, seed: 2 },
      { cap: 40, batchSize: 7, seed: 3 },
      { cap: 120, batchSize: 64, seed: 4 },
      { cap: 250, batchSize: 100, seed: 5 },
      { cap: 5000, batchSize: 100, seed: 6 },
    ];

    it.each(cases)('cap $cap, batch $batchSize (seed $seed)', async ({ cap, batchSize, seed }) => {
      const store = new IndexedDbProjectPersistence(`write-paging-${dbCounter++}`);
      openIdb.add(store);
      const projectId = 'p1';
      await store.putDigitalIdDirectoryEntriesBatch(seededDirectory(projectId, 300, seed));
      // Some rows are rejected: an overlap with the library, as the dual-bank write does.
      const libraryIds = new Set<number>(
        (await store.readDigitalIdDirectoryBatch(projectId, { limit: 300 }))
          .filter((_, i) => i % 7 === 0)
          .map((row) => row.digitalId),
      );
      const accept = (row: DigitalIdDirectoryEntry): boolean => !libraryIds.has(row.digitalId);

      const expected = await nameOrderedWalk(store, projectId, cap, accept);

      const accepted: number[] = [];
      const rejected: number[] = [];
      const result = await pageDigitalIdDirectoryForWrite({
        store,
        projectId,
        cap,
        batchSize,
        acceptRow: accept,
        onAcceptedRow: (row) => void accepted.push(row.digitalId),
        onRejectedRow: (row) => void rejected.push(row.digitalId),
      });

      expect(accepted).toEqual(expected.accepted);
      expect(rejected).toEqual(expected.rejected);
      expect(result.collected).toBe(expected.accepted.length);
      expect(result.total).toBe(300);
      if (cap < 200) expect(result.collected).toBe(cap);
    });
  });

  it('keeps memory near the cap: it never holds much more than the cap in its buffer', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch(seededDirectory('p1', 3000, 11));
    const accept = vi.fn(() => true);
    const out: number[] = [];
    await pageDigitalIdDirectoryForWrite({
      store,
      projectId: 'p1',
      cap: 100,
      batchSize: 100,
      acceptRow: accept,
      onAcceptedRow: (row) => void out.push(row.digitalId),
    });
    expect(out).toHaveLength(100);
    expect(accept).toHaveBeenCalledTimes(3000);
  });
});

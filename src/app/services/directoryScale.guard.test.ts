/**
 * Scale guard for the ID directory. It counts IndexedDB operations, never milliseconds, so it
 * cannot flake on a slow machine. A real browser pays one round trip per request, and an index
 * `count` or a cursor walk is O(rows), so these budgets are what keep a 300k-row directory usable.
 *
 * n is small and every reader takes an injected batch size, so a few hundred rows still span many
 * batches. Each budget is linear in n / batch; the offset paging this replaced re-walked the
 * skipped rows on every page and blows through all of them.
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { IndexedDbProjectPersistence } from '@integrations/persistence/indexedDb.ts';
import { pageDigitalIdDirectoryForWrite } from './directoryWritePaging.ts';

const N = 1000;
const BATCH = 50;
const BATCHES = Math.ceil(N / BATCH);

interface IdbOps {
  /** `continue`, `advance` (by its count) and `continuePrimaryKey`: one cursor row each. */
  cursorSteps: number;
  getAll: number;
  indexCount: number;
  storeCount: number;
  storeDelete: number;
}

type Proto = Record<string, (...args: unknown[]) => unknown>;

/** Wrap the IndexedDB prototypes with counters while `fn` runs. */
async function countIdbOps(fn: () => Promise<unknown>): Promise<IdbOps> {
  const ops: IdbOps = { cursorSteps: 0, getAll: 0, indexCount: 0, storeCount: 0, storeDelete: 0 };
  const patches: { proto: Proto; name: string; original: Proto[string] }[] = [];
  const wrap = (proto: object, name: string, onCall: (args: unknown[]) => void): void => {
    const target = proto as Proto;
    const original = target[name]!;
    patches.push({ proto: target, name, original });
    target[name] = function (this: unknown, ...args: unknown[]) {
      onCall(args);
      return original.apply(this, args);
    };
  };

  for (const name of ['continue', 'continuePrimaryKey']) {
    wrap(globalThis.IDBCursor.prototype, name, () => void (ops.cursorSteps += 1));
  }
  wrap(globalThis.IDBCursor.prototype, 'advance', (args) => {
    ops.cursorSteps += Number(args[0] ?? 1);
  });
  wrap(globalThis.IDBObjectStore.prototype, 'getAll', () => void (ops.getAll += 1));
  wrap(globalThis.IDBIndex.prototype, 'getAll', () => void (ops.getAll += 1));
  wrap(globalThis.IDBIndex.prototype, 'count', () => void (ops.indexCount += 1));
  wrap(globalThis.IDBObjectStore.prototype, 'count', () => void (ops.storeCount += 1));
  wrap(globalThis.IDBObjectStore.prototype, 'delete', () => void (ops.storeDelete += 1));

  try {
    await fn();
  } finally {
    for (const { proto, name, original } of patches) proto[name] = original;
  }
  return ops;
}

let dbSeq = 0;
const stores: IndexedDbProjectPersistence[] = [];

function row(projectId: string, i: number): DigitalIdDirectoryEntry {
  return {
    projectId,
    digitalId: 2_340_000 + i,
    mode: 'dmr',
    // Spread names out of ID order so the name-ordered write collect has real work to do.
    name: `Name ${String((i * 7919) % N).padStart(5, '0')}`,
    callsign: `M0${i}`,
    city: 'Glasgow',
    state: 'Scotland',
    country: 'United Kingdom',
  };
}

async function seeded(): Promise<{ store: IndexedDbProjectPersistence; projectId: string }> {
  const store = new IndexedDbProjectPersistence(`directory-scale-${dbSeq++}`);
  stores.push(store);
  const meta = newProjectMeta('Scale');
  await store.seedProject({ meta });
  const rows = Array.from({ length: N }, (_, i) => row(meta.projectId, i));
  for (let i = 0; i < rows.length; i += 500) {
    await store.putDigitalIdDirectoryEntriesBatch(rows.slice(i, i + 500));
  }
  return { store, projectId: meta.projectId };
}

afterEach(() => {
  for (const store of stores.splice(0)) store.close();
});

describe('ID directory scale guard', () => {
  it('collecting for Write reads by primary-key batches, with no cursor walk and no index count', async () => {
    const { store, projectId } = await seeded();
    let collected = 0;
    const ops = await countIdbOps(() =>
      pageDigitalIdDirectoryForWrite({
        store,
        projectId,
        cap: Number.POSITIVE_INFINITY,
        batchSize: BATCH,
        acceptRow: () => true,
        onAcceptedRow: () => void (collected += 1),
      }),
    );
    expect(collected).toBe(N);
    expect(ops.cursorSteps).toBe(0);
    expect(ops.getAll).toBeLessThanOrEqual(BATCHES + 2);
    expect(ops.indexCount).toBe(0);
    expect(ops.storeCount).toBe(1);
  }, 60_000);

  it('collecting for a capped Write still reads linearly', async () => {
    const { store, projectId } = await seeded();
    const ops = await countIdbOps(() =>
      pageDigitalIdDirectoryForWrite({
        store,
        projectId,
        cap: 120,
        batchSize: BATCH,
        acceptRow: () => true,
        onAcceptedRow: () => {},
      }),
    );
    expect(ops.cursorSteps).toBe(0);
    expect(ops.getAll).toBeLessThanOrEqual(BATCHES + 2);
    expect(ops.indexCount).toBe(0);
  }, 60_000);

  it('streaming the directory makes one request per batch, not per row', async () => {
    const { store, projectId } = await seeded();
    let seen = 0;
    const ops = await countIdbOps(() =>
      store.iterateDigitalIdDirectory(projectId, () => void (seen += 1), { batchSize: BATCH }),
    );
    expect(seen).toBe(N);
    expect(ops.cursorSteps).toBe(0);
    expect(ops.getAll).toBeLessThanOrEqual(BATCHES + 2);
  }, 60_000);

  it('an unfiltered directory page and the partition count use primary-range counts only', async () => {
    const { store, projectId } = await seeded();
    const ops = await countIdbOps(async () => {
      const page = await store.queryDigitalIdDirectoryPage({
        projectId,
        offset: 0,
        limit: 50,
        orderBy: 'name',
      });
      expect(page.total).toBe(N);
      expect(await store.countDigitalIdDirectoryEntries(projectId)).toBe(N);
    });
    expect(ops.indexCount).toBe(0);
    expect(ops.storeCount).toBe(2);
  }, 60_000);

  it('deleting a directory is one range delete, with no cursor walk', async () => {
    const { store, projectId } = await seeded();
    let result = { deletedCount: -1 };
    const ops = await countIdbOps(async () => {
      result = await store.deleteDigitalIdDirectoryForProject(projectId);
    });
    expect(result.deletedCount).toBe(N);
    expect(ops.cursorSteps).toBe(0);
    expect(ops.storeDelete).toBeLessThanOrEqual(2);
    expect(await store.countDigitalIdDirectoryEntries(projectId)).toBe(0);
  }, 60_000);

  it('deleting a project takes its directory with a range delete, not one delete per row', async () => {
    const { store, projectId } = await seeded();
    const ops = await countIdbOps(() => store.deleteEntity(projectId, 'project', projectId));
    expect(await store.countDigitalIdDirectoryEntries(projectId)).toBe(0);
    // The seed rows (one project row here) delete one by one; the directory must not.
    expect(ops.storeDelete).toBeLessThanOrEqual(5);
  }, 60_000);

  it('the orphan sweep steps once per project, not per row', async () => {
    const { store, projectId } = await seeded();
    await store.putDigitalIdDirectoryEntriesBatch(
      Array.from({ length: 300 }, (_, i) => row('orphan', i)),
    );
    let swept = -1;
    const ops = await countIdbOps(async () => {
      swept = await store.sweepOrphanDirectoryRows();
    });
    expect(swept).toBe(1);
    // Two projects in the directory: the cursor jumps over each one's rows.
    expect(ops.cursorSteps).toBeLessThanOrEqual(3);
    expect(await store.countDigitalIdDirectoryEntries(projectId)).toBe(N);
    expect(await store.countDigitalIdDirectoryEntries('orphan')).toBe(0);
  }, 60_000);
});

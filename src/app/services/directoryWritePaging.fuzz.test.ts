/**
 * Fuzz: the linear name-ordered selection must keep the same rows, in the same order, and report
 * the same stepped-over rejected rows as the offset walk it replaced (copied here as the oracle).
 */
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { IndexedDbProjectPersistence } from '@integrations/persistence/indexedDb.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { pageDigitalIdDirectoryForWrite } from './directoryWritePaging.ts';

function mk(projectId: string, digitalId: number, name: string): DigitalIdDirectoryEntry {
  return {
    projectId,
    digitalId,
    mode: 'dmr',
    name,
    callsign: 'X',
    city: '',
    state: '',
    country: '',
  };
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const POOL = [
  '',
  'a',
  'A',
  'B',
  'b',
  'İ',
  'i',
  'ΑΣ',
  'ας',
  'ΑΣ ',
  'Z',
  'z',
  '\u{1F600}',
  'ﬀ',
  'ǅ',
  'ß',
  'SS',
  'ss',
  '\u0000',
  ' ',
];
let c = 0;
const open = new Set<IndexedDbProjectPersistence>();
afterEach(() => {
  for (const s of open) s.close();
  open.clear();
});

async function oldWalk(
  store: IndexedDbProjectPersistence,
  pid: string,
  cap: number,
  accept: (r: DigitalIdDirectoryEntry) => boolean,
  pageSize: number,
) {
  const accepted: number[] = [];
  const rejected: number[] = [];
  let offset = 0;
  while (true) {
    const page = await store.queryDigitalIdDirectoryPage({
      projectId: pid,
      offset,
      limit: pageSize,
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

describe('capped Write selection matches the old offset walk (fuzz)', () => {
  for (let seed = 1; seed <= 4; seed++) {
    it(`seed ${seed}`, async () => {
      const r = rng(seed);
      const n = 1 + Math.floor(r() * 60);
      const store = new IndexedDbProjectPersistence(`fz-${c++}`);
      open.add(store);
      const ids = new Set<number>();
      while (ids.size < n) ids.add(1 + Math.floor(r() * 1000));
      const rows = [...ids].map((id) =>
        mk(
          'p',
          id,
          POOL[Math.floor(r() * POOL.length)]! + (r() < 0.3 ? String(Math.floor(r() * 3)) : ''),
        ),
      );
      await store.putDigitalIdDirectoryEntriesBatch(rows);
      await store.putDigitalIdDirectoryEntriesBatch([mk('q', 1, 'zzz'), mk('p2', 5, '')]);
      const rejectSet = new Set([...ids].filter(() => r() < 0.3));
      const accept = (row: DigitalIdDirectoryEntry) => !rejectSet.has(row.digitalId);
      const nAcc = n - rejectSet.size;
      const caps = new Set(
        [1, 2, nAcc - 1, nAcc, nAcc + 1, n - 1, n, n + 1, Math.max(1, Math.floor(n / 2))].filter(
          (x) => x >= 1,
        ),
      );
      for (const cap of caps)
        for (const bs of [1, 2, 3, n - 1 || 1, n, n + 1, 1000]) {
          const exp = await oldWalk(store, 'p', cap, accept, 7);
          const acc: number[] = [];
          const rej: number[] = [];
          const res = await pageDigitalIdDirectoryForWrite({
            store,
            projectId: 'p',
            cap,
            batchSize: bs,
            acceptRow: accept,
            onAcceptedRow: (x) => void acc.push(x.digitalId),
            onRejectedRow: (x) => void rej.push(x.digitalId),
          });
          expect({ cap, bs, acc }).toEqual({ cap, bs, acc: exp.accepted });
          expect({ cap, bs, rej: rej.filter((id) => rejectSet.has(id)) }).toEqual({
            cap,
            bs,
            rej: exp.rejected,
          });
          expect(res.total).toBe(n);
        }
    }, 120000);
  }
});

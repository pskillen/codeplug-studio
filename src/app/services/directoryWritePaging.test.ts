import { describe, expect, it, vi } from 'vitest';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import {
  DIRECTORY_WRITE_PAGE_SIZE,
  pageDigitalIdDirectoryForWrite,
} from './directoryWritePaging.ts';

function makeEntry(projectId: string, digitalId: number): DigitalIdDirectoryEntry {
  return {
    projectId,
    digitalId,
    mode: 'dmr',
    name: `Name ${digitalId}`,
    callsign: `M0TEST${digitalId}`,
    city: 'City',
    state: 'ST',
    country: 'England',
  };
}

describe('pageDigitalIdDirectoryForWrite', () => {
  it('stops paging once the cap is filled', async () => {
    const store = new InMemoryProjectPersistence();
    const rows = Array.from({ length: DIRECTORY_WRITE_PAGE_SIZE + 50 }, (_, i) =>
      makeEntry('p1', 10_000 + i),
    );
    await store.putDigitalIdDirectoryEntriesBatch(rows);

    const pageSpy = vi.spyOn(store, 'queryDigitalIdDirectoryPage');
    const collected: number[] = [];

    const { total, collected: count } = await pageDigitalIdDirectoryForWrite({
      store,
      projectId: 'p1',
      cap: 100,
      acceptRow: (row) => row.digitalId > 0,
      onAcceptedRow: (row) => {
        collected.push(row.digitalId);
      },
    });

    expect(total).toBe(rows.length);
    expect(count).toBe(100);
    expect(collected).toHaveLength(100);
    expect(pageSpy.mock.calls.length).toBeLessThan(
      Math.ceil(rows.length / DIRECTORY_WRITE_PAGE_SIZE),
    );
  });

  it('reports progress while paging', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch(
      Array.from({ length: 20 }, (_, i) => makeEntry('p1', 20_000 + i)),
    );
    const onProgress = vi.fn();

    await pageDigitalIdDirectoryForWrite({
      store,
      projectId: 'p1',
      cap: 10,
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
});

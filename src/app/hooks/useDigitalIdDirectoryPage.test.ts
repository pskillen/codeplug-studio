import { renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type {
  DirectoryPersistenceListener,
  ProjectPersistence,
} from '@integrations/persistence/index.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';

const store = vi.hoisted(() => ({
  persistence: null as ProjectPersistence | null,
  directoryListeners: new Set<DirectoryPersistenceListener>(),
}));

vi.mock('../state/persistence.ts', () => ({
  persistence: {
    queryDigitalIdDirectoryPage: (
      ...args: Parameters<ProjectPersistence['queryDigitalIdDirectoryPage']>
    ) => store.persistence!.queryDigitalIdDirectoryPage(...args),
    subscribeDirectory: (listener: DirectoryPersistenceListener) => {
      store.directoryListeners.add(listener);
      return () => store.directoryListeners.delete(listener);
    },
  },
}));

import { useDigitalIdDirectoryPage } from './useDigitalIdDirectoryPage.ts';

function sampleEntry(projectId: string, digitalId: number, name: string): DigitalIdDirectoryEntry {
  return {
    projectId,
    digitalId,
    mode: 'dmr',
    name,
    callsign: 'M0TEST',
    city: 'City',
    state: 'ST',
    country: 'England',
  };
}

describe('useDigitalIdDirectoryPage', () => {
  const projectId = 'project-hook-test';

  beforeEach(() => {
    store.persistence = new InMemoryProjectPersistence();
    store.directoryListeners.clear();
  });

  afterEach(() => {
    store.persistence = null;
    store.directoryListeners.clear();
  });

  it('loads a page from persistence', async () => {
    await store.persistence!.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(projectId, 1, 'Alpha'),
      sampleEntry(projectId, 2, 'Bravo'),
    ]);

    const { result } = renderHook(() =>
      useDigitalIdDirectoryPage(projectId, { page: 1, pageSize: 1, orderBy: 'name' }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.total).toBe(2);
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]?.name).toBe('Alpha');
    expect(result.current.pageCount).toBe(2);
  });

  it('refetches when directory notifications arrive', async () => {
    await store.persistence!.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(projectId, 1, 'Alpha'),
    ]);

    const { result } = renderHook(() =>
      useDigitalIdDirectoryPage(projectId, { page: 1, pageSize: 10 }),
    );
    await waitFor(() => expect(result.current.total).toBe(1));

    await store.persistence!.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(projectId, 2, 'Bravo'),
    ]);
    await act(async () => {
      for (const listener of store.directoryListeners) {
        listener({ projectId, digitalId: 2, op: 'put' });
      }
    });

    await waitFor(() => expect(result.current.total).toBe(2));
  });

  it('passes digitalIdPrefix filter to persistence', async () => {
    const querySpy = vi.spyOn(store.persistence!, 'queryDigitalIdDirectoryPage');
    await store.persistence!.putDigitalIdDirectoryEntriesBatch([
      sampleEntry(projectId, 3109478, 'Hiram'),
    ]);

    const { result } = renderHook(() =>
      useDigitalIdDirectoryPage(projectId, {
        page: 1,
        pageSize: 10,
        filters: { digitalIdPrefix: '3109' },
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(querySpy).toHaveBeenCalledWith(expect.objectContaining({ digitalIdPrefix: '3109' }));
    expect(result.current.total).toBe(1);
  });

  it('clears rows when projectId is missing', async () => {
    const { result } = renderHook(() => useDigitalIdDirectoryPage(null, { page: 1, pageSize: 10 }));

    expect(result.current.rows).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.loading).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import {
  countRadioidBulkImportTargets,
  formatRadioidBulkImportEta,
  runRadioidBulkImport,
} from './radioidBulkImport.ts';

const listing = {
  id: 1234567,
  callsign: 'M7ABC',
  fname: 'Ada',
  surname: 'Lovelace',
  name: '',
  city: 'London',
  state: 'England',
  country: 'United Kingdom',
};

const listingTwo = {
  id: 7654321,
  callsign: 'M7XYZ',
  fname: 'Grace',
  surname: 'Hopper',
  name: '',
  city: 'Arlington',
  state: 'Virginia',
  country: 'United States',
};

vi.mock('@integrations/radioid/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@integrations/radioid/index.ts')>();
  return {
    ...actual,
    searchRadioidDmrUsers: vi.fn(),
  };
});

import { searchRadioidDmrUsers } from '@integrations/radioid/index.ts';

const mockSearch = vi.mocked(searchRadioidDmrUsers);

describe('countRadioidBulkImportTargets', () => {
  it('counts new vs existing by digitalId in the directory', () => {
    expect(countRadioidBulkImportTargets([listing], new Set([1234567]))).toEqual({
      newCount: 0,
      existingCount: 1,
    });
    expect(countRadioidBulkImportTargets([listing], new Set())).toEqual({
      newCount: 1,
      existingCount: 0,
    });
  });
});

describe('formatRadioidBulkImportEta', () => {
  it('formats seconds and minutes', () => {
    expect(formatRadioidBulkImportEta(5000)).toBe('~5s');
    expect(formatRadioidBulkImportEta(185_000)).toBe('~3m 5s');
    expect(formatRadioidBulkImportEta(null)).toBe('—');
  });
});

describe('runRadioidBulkImport', () => {
  it('adds new directory entries for page scope', async () => {
    const persistence = new InMemoryProjectPersistence();
    const progress: number[] = [];
    const contactBatchSpy = vi.spyOn(persistence, 'putDigitalContactsBatch');
    const directoryBatchSpy = vi.spyOn(persistence, 'putDigitalIdDirectoryEntriesBatch');

    const result = await runRadioidBulkImport({
      scope: 'page',
      updateExisting: false,
      projectId: 'p1',
      listings: [listing],
      persistence,
      onProgress: (p) => progress.push(p.processed),
    });

    expect(result).toMatchObject({ added: 1, updated: 0, skipped: 0, failed: 0, error: null });
    expect(progress).toContain(1);
    expect(contactBatchSpy).not.toHaveBeenCalled();
    expect(directoryBatchSpy).toHaveBeenCalledTimes(1);
    const saved = await persistence.listDigitalIdDirectoryEntries('p1');
    expect(saved).toHaveLength(1);
    expect(saved[0]?.digitalId).toBe(1234567);
    expect(saved[0]?.city).toBe('London');
    expect(await persistence.listDigitalContacts('p1')).toHaveLength(0);
  });

  it('updates existing directory entries when enabled', async () => {
    const persistence = new InMemoryProjectPersistence();
    await persistence.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: 'p1',
        digitalId: 1234567,
        mode: 'dmr',
        name: 'Ada Lovelace',
        callsign: 'M7ABC',
        city: 'Old City',
        state: 'England',
        country: 'United Kingdom',
      },
    ]);

    const result = await runRadioidBulkImport({
      scope: 'page',
      updateExisting: true,
      projectId: 'p1',
      listings: [listing],
      persistence,
      onProgress: () => {},
    });

    expect(result).toMatchObject({ added: 0, updated: 1, skipped: 0, failed: 0 });
    const saved = await persistence.getDigitalIdDirectoryEntry('p1', 1234567);
    expect(saved?.city).toBe('London');
  });

  it('skips existing directory entries when updateExisting is false', async () => {
    const persistence = new InMemoryProjectPersistence();
    await persistence.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: 'p1',
        digitalId: 1234567,
        mode: 'dmr',
        name: 'Ada Lovelace',
        callsign: 'M7ABC',
        city: 'Old City',
        state: 'England',
        country: 'United Kingdom',
      },
    ]);

    const result = await runRadioidBulkImport({
      scope: 'page',
      updateExisting: false,
      projectId: 'p1',
      listings: [listing],
      persistence,
      onProgress: () => {},
    });

    expect(result).toMatchObject({ added: 0, updated: 0, skipped: 1, failed: 0 });
    const saved = await persistence.getDigitalIdDirectoryEntry('p1', 1234567);
    expect(saved?.city).toBe('Old City');
  });

  it('imports all scope across multiple fetched pages', async () => {
    const persistence = new InMemoryProjectPersistence();
    mockSearch
      .mockResolvedValueOnce({
        listings: [listing],
        count: 2,
        page: 1,
        perPage: 1,
        pages: 2,
      })
      .mockResolvedValueOnce({
        listings: [listingTwo],
        count: 2,
        page: 2,
        perPage: 1,
        pages: 2,
      });

    const contactBatchSpy = vi.spyOn(persistence, 'putDigitalContactsBatch');
    const directoryBatchSpy = vi.spyOn(persistence, 'putDigitalIdDirectoryEntriesBatch');

    const result = await runRadioidBulkImport({
      scope: 'all',
      updateExisting: false,
      projectId: 'p1',
      filters: {
        id: '',
        callsign: '',
        city: '',
        state: '',
        country: 'United Kingdom',
      },
      totalPages: 2,
      totalCount: 2,
      persistence,
      onProgress: () => {},
    });

    expect(result).toMatchObject({ added: 2, updated: 0, skipped: 0, failed: 0, error: null });
    expect(mockSearch).toHaveBeenCalledTimes(2);
    expect(contactBatchSpy).not.toHaveBeenCalled();
    expect(directoryBatchSpy).toHaveBeenCalledTimes(2);
    expect(await persistence.listDigitalIdDirectoryEntries('p1')).toHaveLength(2);
    expect(await persistence.listDigitalContacts('p1')).toHaveLength(0);
  });

  it('does not emit library persistence notifications for directory import', async () => {
    const persistence = new InMemoryProjectPersistence();
    const libraryChanges: unknown[] = [];
    const directoryChanges: unknown[] = [];
    const unsubscribeLibrary = persistence.subscribe((change) => libraryChanges.push(change));
    const unsubscribeDirectory = persistence.subscribeDirectory((change) =>
      directoryChanges.push(change),
    );

    await runRadioidBulkImport({
      scope: 'page',
      updateExisting: false,
      projectId: 'p1',
      listings: [listing, listingTwo],
      persistence,
      onProgress: () => {},
    });

    unsubscribeLibrary();
    unsubscribeDirectory();
    expect(libraryChanges).toEqual([]);
    expect(directoryChanges).toEqual([{ projectId: 'p1', digitalId: 1234567, op: 'put' }]);
  });
});

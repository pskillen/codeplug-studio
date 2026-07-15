import { describe, expect, it, vi } from 'vitest';
import { newDigitalContact } from '@core/domain/factories.ts';
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
  it('counts new vs existing by digitalId', () => {
    const existing = { ...newDigitalContact('p1', 'Old', 1234567, 'dmr'), callsign: 'M7ABC' };
    expect(countRadioidBulkImportTargets([listing], [existing])).toEqual({
      newCount: 0,
      existingCount: 1,
    });
    expect(countRadioidBulkImportTargets([listing], [])).toEqual({
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
  it('adds new contacts for page scope', async () => {
    const persistence = new InMemoryProjectPersistence();
    const progress: number[] = [];

    const result = await runRadioidBulkImport({
      scope: 'page',
      updateExisting: false,
      projectId: 'p1',
      contacts: [],
      listings: [listing],
      persistence,
      onProgress: (p) => progress.push(p.processed),
    });

    expect(result).toMatchObject({ added: 1, updated: 0, skipped: 0, failed: 0, error: null });
    expect(progress).toContain(1);
    const saved = await persistence.listDigitalContacts('p1');
    expect(saved).toHaveLength(1);
    expect(saved[0]?.digitalId).toBe(1234567);
    expect(saved[0]?.city).toBe('London');
  });

  it('updates existing contacts when enabled', async () => {
    const persistence = new InMemoryProjectPersistence();
    const existing = {
      ...newDigitalContact('p1', 'Ada Lovelace', 1234567, 'dmr'),
      callsign: 'M7ABC',
      city: 'Old City',
      country: 'United Kingdom',
    };
    await persistence.putDigitalContact(existing, null);

    const result = await runRadioidBulkImport({
      scope: 'page',
      updateExisting: true,
      projectId: 'p1',
      contacts: [existing],
      listings: [listing],
      persistence,
      onProgress: () => {},
    });

    expect(result).toMatchObject({ added: 0, updated: 1, skipped: 0, failed: 0 });
    const saved = await persistence.listDigitalContacts('p1');
    expect(saved[0]?.city).toBe('London');
  });

  it('skips existing contacts when updateExisting is false', async () => {
    const persistence = new InMemoryProjectPersistence();
    const existing = {
      ...newDigitalContact('p1', 'Ada Lovelace', 1234567, 'dmr'),
      callsign: 'M7ABC',
      city: 'Old City',
      country: 'United Kingdom',
    };
    await persistence.putDigitalContact(existing, null);

    const result = await runRadioidBulkImport({
      scope: 'page',
      updateExisting: false,
      projectId: 'p1',
      contacts: [existing],
      listings: [listing],
      persistence,
      onProgress: () => {},
    });

    expect(result).toMatchObject({ added: 0, updated: 0, skipped: 1, failed: 0 });
    const saved = await persistence.listDigitalContacts('p1');
    expect(saved[0]?.city).toBe('Old City');
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

    const batchSpy = vi.spyOn(persistence, 'putDigitalContactsBatch');

    const result = await runRadioidBulkImport({
      scope: 'all',
      updateExisting: false,
      projectId: 'p1',
      contacts: [],
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
    expect(batchSpy).toHaveBeenCalledTimes(2);
    const saved = await persistence.listDigitalContacts('p1');
    expect(saved).toHaveLength(2);
  });

  it('emits one persistence notification for the whole import', async () => {
    const persistence = new InMemoryProjectPersistence();
    const changes: { kind: string }[] = [];
    const unsubscribe = persistence.subscribe((change) => changes.push(change));

    await runRadioidBulkImport({
      scope: 'page',
      updateExisting: false,
      projectId: 'p1',
      contacts: [],
      listings: [listing, listingTwo],
      persistence,
      onProgress: () => {},
    });

    unsubscribe();
    expect(changes).toEqual([{ projectId: 'p1', kind: 'project', id: 'p1', op: 'put' }]);
  });
});

import { describe, expect, it } from 'vitest';
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
});

import { describe, expect, it } from 'vitest';
import { newProjectMeta } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import {
  exportDirectoryInterchangeContent,
  importDirectoryInterchangeContent,
  roundTripDirectoryInterchangeForTest,
} from './digitalIdDirectoryInterchangeService.ts';

describe('digitalIdDirectoryInterchangeService', () => {
  it('round-trips YAML export → clear → import', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Round trip');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: meta.projectId,
        digitalId: 100,
        mode: 'dmr',
        callsign: 'M0RT',
        name: 'Round',
        city: 'A',
        state: 'B',
        country: 'GB',
      },
    ]);

    const { exported, imported } = await roundTripDirectoryInterchangeForTest(
      store,
      meta.projectId,
      'yaml',
    );
    expect(imported).toEqual(exported);
  });

  it('round-trips CSV export → clear → import', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('CSV trip');
    await store.seedProject({ meta });
    await store.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: meta.projectId,
        digitalId: 200,
        mode: 'dmr',
        callsign: 'G1RT',
        name: 'Csv',
        city: '',
        state: '',
        country: '',
        remarks: 'x',
      },
    ]);

    const { exported, imported } = await roundTripDirectoryInterchangeForTest(
      store,
      meta.projectId,
      'csv',
    );
    expect(imported).toEqual(exported);
  });

  it('upserts imported rows by digitalId', async () => {
    const store = new InMemoryProjectPersistence();
    const meta = newProjectMeta('Upsert');
    await store.seedProject({ meta });
    const exported = await exportDirectoryInterchangeContent(store, meta.projectId, 'yaml');
    expect(exported.rowCount).toBe(0);

    const yaml = [
      'schemaVersion: 1',
      'entries:',
      '  - digitalId: 42',
      '    mode: dmr',
      '    callsign: M0UP',
      '    name: Upsert',
      '    city: ""',
      '    state: ""',
      '    country: GB',
    ].join('\n');
    const result = await importDirectoryInterchangeContent(store, meta.projectId, yaml, 'yaml');
    expect(result.imported).toBe(1);
    expect(await store.getDigitalIdDirectoryEntry(meta.projectId, 42)).toMatchObject({
      callsign: 'M0UP',
    });
  });
});

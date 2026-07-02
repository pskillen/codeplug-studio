import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { newChannel, newProjectMeta } from '@core/domain/factories.ts';
import { IndexedDbProjectPersistence } from '@integrations/persistence/indexedDb.ts';
import {
  filterIndexedDbRowSummaries,
  getStoreRow,
  indexedDbRowViewerPath,
  indexedDbStorePath,
  isKnownStoreName,
  listStoreRows,
  listStoreSummaries,
  summarizeIndexedDbRow,
} from './indexedDbInspect.ts';

let counter = 0;
const open = new Set<IndexedDbProjectPersistence>();

function makeStore(): { persistence: IndexedDbProjectPersistence; dbName: string } {
  const dbName = `test-debug-db-${counter++}`;
  const persistence = new IndexedDbProjectPersistence(dbName);
  open.add(persistence);
  return { persistence, dbName };
}

afterEach(() => {
  for (const store of open) store.close();
  open.clear();
});

describe('indexedDbInspect', () => {
  it('isKnownStoreName recognises persistence stores', () => {
    expect(isKnownStoreName('channels')).toBe(true);
    expect(isKnownStoreName('unknown')).toBe(false);
  });

  it('indexedDb paths encode route segments', () => {
    expect(indexedDbStorePath('channels')).toBe('/debug/indexed-db/channels');
    expect(indexedDbRowViewerPath('channels', 'proj-1', 'ch-1')).toBe(
      '/debug/indexed-db/channels/proj-1/ch-1',
    );
  });

  it('listStoreSummaries returns per-store counts grouped by project', async () => {
    const { persistence, dbName } = makeStore();
    const meta = newProjectMeta('North');
    const channel = newChannel(meta.projectId, 'Alpha');
    await persistence.seedProject({ meta, channels: [channel] });

    const summaries = await listStoreSummaries(dbName);
    const projects = summaries.find((summary) => summary.storeName === 'projects');
    const channels = summaries.find((summary) => summary.storeName === 'channels');

    expect(projects?.totalRows).toBe(1);
    expect(projects?.byProject).toEqual([{ projectId: meta.projectId, count: 1 }]);
    expect(channels?.totalRows).toBe(1);
    expect(channels?.byProject).toEqual([{ projectId: meta.projectId, count: 1 }]);
  });

  it('listStoreRows and getStoreRow read entity rows', async () => {
    const { persistence, dbName } = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Bravo', 'GB3RF');
    await persistence.seedProject({ meta, channels: [channel] });

    const rows = await listStoreRows('channels', meta.projectId, dbName);
    expect(rows).toHaveLength(1);
    expect((rows[0] as { name: string }).name).toBe('Bravo');

    const row = await getStoreRow('channels', meta.projectId, channel.id, dbName);
    expect(row).toMatchObject({ id: channel.id, name: 'Bravo', callsign: 'GB3RF' });
  });

  it('summarizeIndexedDbRow extracts callsign when present', () => {
    expect(
      summarizeIndexedDbRow({
        projectId: 'p1',
        id: 'ch-1',
        name: 'Alpha',
        callsign: 'GB3DA',
      }),
    ).toEqual({
      projectId: 'p1',
      id: 'ch-1',
      name: 'Alpha',
      callsign: 'GB3DA',
    });
    expect(
      summarizeIndexedDbRow({
        projectId: 'p1',
        id: 'z-1',
        name: 'Zone A',
      }),
    ).toEqual({
      projectId: 'p1',
      id: 'z-1',
      name: 'Zone A',
      callsign: null,
    });
  });

  it('filterIndexedDbRowSummaries matches name, callsign, project id, and entity id', () => {
    const rows = [
      {
        projectId: 'proj-north',
        id: 'ch-1',
        name: 'Stornoway',
        callsign: 'GB3DA',
      },
      {
        projectId: 'proj-south',
        id: 'ch-2',
        name: 'Inverness',
        callsign: 'GB3IV',
      },
    ];

    expect(filterIndexedDbRowSummaries(rows, 'gb3da')).toHaveLength(1);
    expect(filterIndexedDbRowSummaries(rows, 'inverness')).toHaveLength(1);
    expect(filterIndexedDbRowSummaries(rows, 'proj-north')).toHaveLength(1);
    expect(filterIndexedDbRowSummaries(rows, 'ch-2')).toHaveLength(1);
    expect(filterIndexedDbRowSummaries(rows, '')).toHaveLength(2);
  });
});

import { formatExportWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import { describe, expect, it, vi } from 'vitest';
import { newDigitalContact } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import { collectDualBankDirectorySlice } from './dualBankRadioWrite.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';

function emptyLibrary(): LibrarySlice {
  return {
    channels: [],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  };
}

describe('collectDualBankDirectorySlice', () => {
  it('streams directory rows into DM-32 address-book DTOs and skips library overlaps when Both', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: 'p1',
        digitalId: 1001,
        mode: 'dmr',
        name: 'Alpha',
        callsign: 'A1',
        city: '',
        state: '',
        country: '',
      },
      {
        projectId: 'p1',
        digitalId: 2002,
        mode: 'dmr',
        name: 'Beta',
        callsign: 'B2',
        city: '',
        state: '',
        country: '',
      },
    ]);
    const warnings: ExportWarning[] = [];
    const library: LibrarySlice = {
      ...emptyLibrary(),
      digitalContacts: [
        {
          ...newDigitalContact('p1', 'Curated', 1001, 'dmr'),
          id: 'dc-1',
        },
      ],
    };
    const slice = await collectDualBankDirectorySlice({
      store,
      projectId: 'p1',
      library,
      egressProfileId: 'radio-io-dm32uv',
      options: { includeLibraryContacts: true, includeDigitalIdDirectory: true },
      warnings,
    });
    expect(slice.radioIds).toEqual([]);
    expect(slice.digitalContacts.map((row) => row.digitalId)).toEqual([2002]);
    expect(warnings.some((w) => formatExportWarning(w).includes('Skipped 1 directory row'))).toBe(
      true,
    );
  });

  it('keeps overlapping DM-32 directory IDs on RadioID-only (address book replaced)', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: 'p1',
        digitalId: 1001,
        mode: 'dmr',
        name: 'Alpha',
        callsign: 'A1',
        city: '',
        state: '',
        country: '',
      },
    ]);
    const warnings: ExportWarning[] = [];
    const library: LibrarySlice = {
      ...emptyLibrary(),
      digitalContacts: [
        {
          ...newDigitalContact('p1', 'Curated', 1001, 'dmr'),
          id: 'dc-1',
        },
      ],
    };
    const slice = await collectDualBankDirectorySlice({
      store,
      projectId: 'p1',
      library,
      egressProfileId: 'radio-io-dm32uv',
      options: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
      warnings,
    });
    expect(slice.digitalContacts.map((row) => row.digitalId)).toEqual([1001]);
    expect(warnings.some((w) => formatExportWarning(w).includes('Skipped'))).toBe(false);
  });

  it('returns empty slice when directory toggle is off', async () => {
    const store = new InMemoryProjectPersistence();
    const pageSpy = vi.spyOn(store, 'queryDigitalIdDirectoryPage');
    const slice = await collectDualBankDirectorySlice({
      store,
      projectId: 'p1',
      library: emptyLibrary(),
      egressProfileId: 'radio-io-dm32uv',
      options: { includeLibraryContacts: true, includeDigitalIdDirectory: false },
      warnings: [],
    });
    expect(slice).toEqual({ radioIds: [], digitalContacts: [] });
    expect(pageSpy).not.toHaveBeenCalled();
  });

  it('warns when directory total exceeds OpenGD77 cap without scanning past the cap', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch(
      Array.from({ length: 120 }, (_, i) => ({
        projectId: 'p1',
        digitalId: 30_000 + i,
        mode: 'dmr' as const,
        name: `Row ${i}`,
        callsign: `M0X${i}`,
        city: '',
        state: '',
        country: '',
      })),
    );
    const pageSpy = vi.spyOn(store, 'queryDigitalIdDirectoryPage');
    const warnings: ExportWarning[] = [];
    const slice = await collectDualBankDirectorySlice({
      store,
      projectId: 'p1',
      library: emptyLibrary(),
      egressProfileId: 'radio-io-opengd77-1701',
      options: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
      maxDirectoryContacts: 50,
      warnings,
    });
    expect(slice.digitalContacts).toHaveLength(50);
    expect(
      warnings.some((w) => formatExportWarning(w).includes('only 50 write from directory')),
    ).toBe(true);
    expect(pageSpy.mock.calls.length).toBeLessThan(3);
  });

  it('keeps OpenGD77 directory rows whose DMR ID already exists in the library', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: 'p1',
        digitalId: 1001,
        mode: 'dmr',
        name: 'Alpha',
        callsign: 'A1',
        city: '',
        state: '',
        country: '',
      },
      {
        projectId: 'p1',
        digitalId: 2002,
        mode: 'dmr',
        name: 'Beta',
        callsign: 'B2',
        city: '',
        state: '',
        country: '',
      },
    ]);
    const warnings: ExportWarning[] = [];
    const library: LibrarySlice = {
      ...emptyLibrary(),
      digitalContacts: [
        {
          ...newDigitalContact('p1', 'Curated', 1001, 'dmr'),
          id: 'dc-1',
        },
      ],
    };
    const slice = await collectDualBankDirectorySlice({
      store,
      projectId: 'p1',
      library,
      egressProfileId: 'radio-io-opengd77-1701',
      options: { includeLibraryContacts: true, includeDigitalIdDirectory: true },
      warnings,
    });
    expect(slice.radioIds).toEqual([]);
    expect(slice.digitalContacts.map((row) => row.digitalId).sort()).toEqual([1001, 2002]);
    expect(warnings.some((w) => formatExportWarning(w).includes('Skipped'))).toBe(false);
  });
});

describe('collectDualBankDirectorySlice AT-D890 ID database (#1433)', () => {
  async function storeWith(ids: readonly number[]): Promise<InMemoryProjectPersistence> {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch(
      ids.map((digitalId) => ({
        projectId: 'p1',
        digitalId,
        mode: 'dmr' as const,
        name: `Row ${digitalId}`,
        callsign: `M0${digitalId}`,
        city: '',
        state: '',
        country: '',
      })),
    );
    return store;
  }

  it('collects the directory for the radio-io-at-d890uv egress', async () => {
    const slice = await collectDualBankDirectorySlice({
      store: await storeWith([1001, 2002]),
      projectId: 'p1',
      library: emptyLibrary(),
      egressProfileId: 'radio-io-at-d890uv',
      options: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
      warnings: [],
    });
    expect(slice.digitalContacts.map((row) => row.digitalId).sort()).toEqual([1001, 2002]);
  });

  it('skips build contact IDs even for ID directory alone', async () => {
    const warnings: ExportWarning[] = [];
    const library: LibrarySlice = {
      ...emptyLibrary(),
      // A library contact outside the build: its directory row stays.
      digitalContacts: [{ ...newDigitalContact('p1', 'Unbuilt', 2002, 'dmr'), id: 'dc-2' }],
    };
    const slice = await collectDualBankDirectorySlice({
      store: await storeWith([1001, 2002]),
      projectId: 'p1',
      library,
      egressProfileId: 'radio-io-at-d890uv',
      options: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
      libraryDigitalIds: new Set([1001]),
      warnings,
    });
    expect(slice.digitalContacts.map((row) => row.digitalId)).toEqual([2002]);
    expect(warnings.some((w) => formatExportWarning(w).includes('Skipped 1 directory row'))).toBe(
      true,
    );
  });

  it('warns with the AT-D890 ID database label when the directory exceeds the cap', async () => {
    const warnings: ExportWarning[] = [];
    const slice = await collectDualBankDirectorySlice({
      store: await storeWith(Array.from({ length: 30 }, (_, i) => 40_000 + i)),
      projectId: 'p1',
      library: emptyLibrary(),
      egressProfileId: 'radio-io-at-d890uv-mm9pdy',
      options: { includeLibraryContacts: true, includeDigitalIdDirectory: true },
      maxDirectoryContacts: 10,
      warnings,
    });
    expect(slice.digitalContacts).toHaveLength(10);
    expect(
      warnings.some((w) =>
        formatExportWarning(w).includes(
          'than the AT-D890 ID database allows; only 10 write from directory',
        ),
      ),
    ).toBe(true);
  });
});

describe('collectDualBankDirectorySlice RadioFoundry DMR ID database (#1495)', () => {
  it('keeps directory rows, including IDs that are already library contacts', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: 'p1',
        digitalId: 1001,
        mode: 'dmr',
        name: 'Alpha',
        callsign: 'A1',
        city: '',
        state: '',
        country: '',
      },
      {
        projectId: 'p1',
        digitalId: 2002,
        mode: 'dmr',
        name: 'Beta',
        callsign: 'B2',
        city: '',
        state: '',
        country: '',
      },
    ]);
    const warnings: ExportWarning[] = [];
    const slice = await collectDualBankDirectorySlice({
      store,
      projectId: 'p1',
      library: {
        ...emptyLibrary(),
        digitalContacts: [{ ...newDigitalContact('p1', 'Curated', 1001, 'dmr'), id: 'dc-1' }],
      },
      egressProfileId: 'radio-io-dm32uv-radiofoundry',
      options: { includeLibraryContacts: true, includeDigitalIdDirectory: true },
      warnings,
    });
    expect(slice.digitalContacts.map((row) => row.digitalId).sort()).toEqual([1001, 2002]);
    expect(warnings.some((w) => formatExportWarning(w).includes('address book'))).toBe(false);
  });

  it('warns with the DMR ID database label when the directory exceeds the cap', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch(
      Array.from({ length: 12 }, (_, i) => ({
        projectId: 'p1',
        digitalId: 50_000 + i,
        mode: 'dmr' as const,
        name: `Row ${i}`,
        callsign: `M0${i}`,
        city: '',
        state: '',
        country: '',
      })),
    );
    const warnings: ExportWarning[] = [];
    const slice = await collectDualBankDirectorySlice({
      store,
      projectId: 'p1',
      library: emptyLibrary(),
      egressProfileId: 'radio-io-dm32uv-radiofoundry',
      options: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
      maxDirectoryContacts: 4,
      warnings,
    });
    expect(slice.digitalContacts).toHaveLength(4);
    expect(
      warnings.some((w) =>
        formatExportWarning(w).includes(
          'than the RadioFoundry DMR ID database allows; only 4 write from directory',
        ),
      ),
    ).toBe(true);
    expect(warnings.some((w) => formatExportWarning(w).includes('address book'))).toBe(false);
  });
});

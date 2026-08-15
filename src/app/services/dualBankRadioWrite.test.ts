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
  it('streams directory rows into DM-32 radio ID DTOs and skips library overlaps', async () => {
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
    const warnings: string[] = [];
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
      maxRadioIds: 250,
      warnings,
    });
    expect(slice.radioIds).toEqual([{ index: 0, dmrId: 2002, name: 'Beta' }]);
    expect(slice.digitalContacts).toEqual([]);
    expect(warnings.some((w) => w.includes('Skipped 1 directory row'))).toBe(true);
  });

  it('returns empty slice when directory toggle is off', async () => {
    const store = new InMemoryProjectPersistence();
    const iterateSpy = vi.spyOn(store, 'iterateDigitalIdDirectory');
    const slice = await collectDualBankDirectorySlice({
      store,
      projectId: 'p1',
      library: emptyLibrary(),
      egressProfileId: 'radio-io-dm32uv',
      options: { includeLibraryContacts: true, includeDigitalIdDirectory: false },
      warnings: [],
    });
    expect(slice).toEqual({ radioIds: [], digitalContacts: [] });
    expect(iterateSpy).not.toHaveBeenCalled();
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
    const warnings: string[] = [];
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
    expect(warnings.some((w) => w.includes('Skipped'))).toBe(false);
  });
});

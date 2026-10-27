import { describe, expect, it } from 'vitest';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import {
  DM32_CPS_DIRECTORY_WARNING,
  OPENGD77_CPS_DIRECTORY_WARNING,
} from '@core/domain/cpsDigitalDirectoryProjection.ts';
import { newDigitalContact, newRadioBuildForProfile } from '@core/domain/factories.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { enrichCpsExportOptionsWithDirectory } from './cpsDirectoryExport.ts';

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

describe('enrichCpsExportOptionsWithDirectory', () => {
  it('warns that OpenGD77 CPS cannot write the User Database and omits directory from Contacts.csv', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: 'p1',
        digitalId: 2002,
        mode: 'dmr',
        name: 'Dir',
        callsign: 'D1',
        city: '',
        state: '',
        country: '',
      },
    ]);
    const { build, egress } = newRadioBuildForProfile('p1', 'opengd77-1701');
    const library: LibrarySlice = {
      ...emptyLibrary(),
      digitalContacts: [{ ...newDigitalContact('p1', 'Alice', 1001, 'dmr'), id: 'dc-1' }],
    };
    const options = await enrichCpsExportOptionsWithDirectory(store, 'p1', build, egress, library, {
      profileId: egress.profileId,
      cpsDualBankDirectory: {
        includeLibraryContacts: true,
        includeDigitalIdDirectory: true,
      },
    });
    expect(options.directoryProjection?.warnings?.map((w) => formatExportWarning(w))).toContain(
      OPENGD77_CPS_DIRECTORY_WARNING,
    );
    expect(options.directoryProjection?.dualBank?.directoryDigitalContacts).toEqual([]);
  });

  it('warns that DM-32 CPS cannot write the directory and does not emit DMR-ID.csv rows', async () => {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch([
      {
        projectId: 'p1',
        digitalId: 2002,
        mode: 'dmr',
        name: 'Dir',
        callsign: 'D1',
        city: '',
        state: '',
        country: '',
      },
    ]);
    const { build, egress } = newRadioBuildForProfile('p1', 'dm32-baofeng-dm32uv');
    const library: LibrarySlice = {
      ...emptyLibrary(),
      digitalContacts: [{ ...newDigitalContact('p1', 'Alice', 1001, 'dmr'), id: 'dc-1' }],
    };
    const options = await enrichCpsExportOptionsWithDirectory(store, 'p1', build, egress, library, {
      profileId: egress.profileId,
      cpsDualBankDirectory: {
        includeLibraryContacts: true,
        includeDigitalIdDirectory: true,
      },
    });
    expect(options.directoryProjection?.warnings?.map((w) => formatExportWarning(w))).toContain(
      DM32_CPS_DIRECTORY_WARNING,
    );
    expect(options.directoryProjection?.dualBank?.directoryDigitalContacts).toEqual([]);
    expect(options.directoryProjection?.dualBank?.includeDm32RadioIdFile).toBe(false);
    expect(options.directoryProjection?.dualBank?.dm32RadioIds).toEqual([]);
  });
});

describe('enrichCpsExportOptionsWithDirectory — Anytone ID database (#1433)', () => {
  async function storeWith(ids: readonly number[]): Promise<InMemoryProjectPersistence> {
    const store = new InMemoryProjectPersistence();
    await store.putDigitalIdDirectoryEntriesBatch(
      ids.map((digitalId) => ({
        projectId: 'p1',
        digitalId,
        mode: 'dmr' as const,
        name: `Dir ${digitalId}`,
        callsign: `D${digitalId}`,
        city: '',
        state: '',
        country: '',
      })),
    );
    return store;
  }
  const library: LibrarySlice = {
    ...emptyLibrary(),
    digitalContacts: [{ ...newDigitalContact('p1', 'Alice', 1001, 'dmr'), id: 'dc-1' }],
  };

  it('always builds a dual-bank payload that keeps contacts in the assembly, with no CPS warning', async () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'anytone-at-d890uv');
    const options = await enrichCpsExportOptionsWithDirectory(
      await storeWith([2002]),
      'p1',
      build,
      egress,
      library,
      { profileId: egress.profileId },
    );
    const dual = options.directoryProjection?.dualBank;
    expect(dual?.keepLibraryContactsInAssembly).toBe(true);
    expect(dual?.includeLibraryContacts).toBe(true);
    expect(dual?.directoryDigitalContacts).toEqual([]);
    const texts = options.directoryProjection?.warnings?.map((w) => formatExportWarning(w)) ?? [];
    expect(texts).not.toContain(OPENGD77_CPS_DIRECTORY_WARNING);
    expect(texts).not.toContain(DM32_CPS_DIRECTORY_WARNING);
  });

  it('adds directory rows except those for a build contact ID', async () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'anytone-at-d890uv');
    const options = await enrichCpsExportOptionsWithDirectory(
      await storeWith([1001, 2002]),
      'p1',
      build,
      egress,
      library,
      {
        profileId: egress.profileId,
        cpsDualBankDirectory: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
      },
    );
    const rows = options.directoryProjection?.dualBank?.directoryDigitalContacts ?? [];
    expect(rows.map((row) => row.entity.digitalId)).toEqual([2002]);
    expect(rows[0]?.wireName).toBeTruthy();
  });

  it('writes a directory row whose ID matches only a non-DMR contact (#1438)', async () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'anytone-at-d890uv');
    const withNxdn: LibrarySlice = {
      ...library,
      digitalContacts: [
        ...library.digitalContacts,
        { ...newDigitalContact('p1', 'NX Carol', 3003, 'nxdn'), id: 'dc-nx' },
      ],
    };
    const options = await enrichCpsExportOptionsWithDirectory(
      await storeWith([1001, 2002, 3003]),
      'p1',
      build,
      egress,
      withNxdn,
      {
        profileId: egress.profileId,
        cpsDualBankDirectory: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
      },
    );
    const rows = options.directoryProjection?.dualBank?.directoryDigitalContacts ?? [];
    expect(rows.map((row) => row.entity.digitalId)).toEqual([2002, 3003]);
  });

  it('reads a legacy single-bank merge setting as both', async () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'anytone-at-d890uv');
    const options = await enrichCpsExportOptionsWithDirectory(
      await storeWith([2002]),
      'p1',
      {
        ...build,
        exportSettings: { ...build.exportSettings, cpsSingleBankProjectionMode: 'merge' },
      },
      egress,
      library,
      { profileId: egress.profileId },
    );
    const dual = options.directoryProjection?.dualBank;
    expect(dual?.includeLibraryContacts).toBe(true);
    expect(dual?.directoryDigitalContacts.map((row) => row.entity.digitalId)).toEqual([2002]);
  });
});

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

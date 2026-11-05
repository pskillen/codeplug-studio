import { describe, expect, it, vi } from 'vitest';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { getProfileExportLimits } from '@core/import-export/profileExportLimits.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';

const pageSpy = vi.hoisted(() => vi.fn());

vi.mock('./directoryWritePaging.ts', () => ({
  pageDigitalIdDirectoryForWrite: pageSpy,
}));

const { collectDualBankDirectorySlice } = await import('./dualBankRadioWrite.ts');

const library: LibrarySlice = {
  channels: [],
  zones: [],
  scanLists: [],
  talkGroups: [],
  digitalContacts: [],
  analogContacts: [],
  rxGroupLists: [],
  aprsConfiguration: null,
};

/** Direct radio profiles that have a caller-ID database the Write fills from the directory. */
const RADIOS_WITH_ID_DATABASE = [
  'radio-io-opengd77-1701',
  'radio-io-opengd77-md9600',
  'radio-io-dm32uv',
  'radio-io-dm32uv-mm9pdy',
  'radio-io-dm32uv-radiofoundry',
  'radio-io-at-d890uv',
  'radio-io-at-d890uv-mm9pdy',
] as const;

describe('digital ID database cap', () => {
  it.each(RADIOS_WITH_ID_DATABASE)(
    '%s: the characteristics row is the cap the directory Write enforces',
    async (profileId) => {
      pageSpy.mockReset();
      pageSpy.mockResolvedValue({ total: 0, collected: 0 });
      await collectDualBankDirectorySlice({
        store: new InMemoryProjectPersistence(),
        projectId: 'p1',
        library,
        egressProfileId: profileId,
        options: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
        warnings: [] as ExportWarning[],
      });
      expect(pageSpy).toHaveBeenCalledTimes(1);
      const writeCap = pageSpy.mock.calls[0]![0].cap as number;

      const limits = getProfileExportLimits('radio-io', profileId);
      expect(limits).not.toBeNull();
      expect(limits!.maxDigitalIdDatabase).toBe(writeCap);
      expect(writeCap).toBeGreaterThan(0);
    },
  );
});

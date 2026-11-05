import { describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import {
  digitalIdDatabaseCap,
  getProfileExportLimits,
} from '@core/import-export/profileExportLimits.ts';
import type { FormatId } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/inMemory.ts';

const collectSpy = vi.hoisted(() => vi.fn());

vi.mock('./dualBankRadioWrite.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./dualBankRadioWrite.ts')>()),
  collectDualBankDirectorySlice: collectSpy,
}));

const { prepareRadioWriteImage } = await import('./radioIoSession.ts');

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
    '%s: the characteristics row is the cap production hands the directory collector',
    async (profileId) => {
      collectSpy.mockReset();
      collectSpy.mockResolvedValue({ radioIds: [], digitalContacts: [] });
      const { build, egress } = newRadioBuildForProfile('p1', profileId);
      try {
        await prepareRadioWriteImage(build, egress, library, {
          dualBank: {
            options: { includeLibraryContacts: false, includeDigitalIdDirectory: true },
          } as never,
          persistence: new InMemoryProjectPersistence(),
          projectId: 'p1',
        });
      } catch {
        // Later projection steps may need a hydrated radio; the collector call is what matters.
      }
      expect(collectSpy).toHaveBeenCalledTimes(1);
      const handed = collectSpy.mock.calls[0]![0].maxDirectoryContacts as number;

      const row = getProfileExportLimits(
        egress.formatId as FormatId,
        egress.profileId,
      )?.maxDigitalIdDatabase;
      expect(typeof row).toBe('number');
      expect(handed).toBe(row);
      expect(handed).toBeGreaterThan(0);
    },
  );

  it('resolves no cap for a profile without an ID database', () => {
    expect(digitalIdDatabaseCap('radio-io', 'radio-io-uv5r-mini')).toBeUndefined();
  });

  it('the CPS export cap for the AT-D890 is the characteristics row', () => {
    for (const profileId of ['at-d890uv', 'at-d890uv-mm9pdy']) {
      const row = getProfileExportLimits('anytone', profileId)?.maxDigitalIdDatabase;
      if (typeof row !== 'number') continue;
      expect(digitalIdDatabaseCap('anytone', profileId)).toBe(row);
    }
  });
});

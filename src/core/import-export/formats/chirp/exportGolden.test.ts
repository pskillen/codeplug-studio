import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatCatalogEntry, getExportAdapter } from '@core/import-export/registry.ts';
import { isSingleFileCpsExportAdapter } from '@core/import-export/exportAdapter.ts';
import { exportBuildSingleFile } from '@core/services/exportBuild.ts';
import {
  compareCsvRecords,
  formatCsvRecordCompareFailure,
} from '../../../../test/csvRecordCompare.ts';
import { libraryAndBuildFromChirpFixture } from './exportGoldenFixtures.ts';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__/export');

const CHIRP_GOLDEN_FIXTURES = [
  { profileId: 'chirp-uv5r', fileName: 'Baofeng_UV-5R Mini_20251129.csv' },
  { profileId: 'chirp-uv21', fileName: 'Baofeng_UV-21ProV2_20251129.csv' },
  { profileId: 'chirp-rt95', fileName: 'Retevis_RT95 VOX_20251106.csv' },
] as const;

describe('chirp/export golden', () => {
  it('registry exposes shipped single-file CPS export adapter', () => {
    expect(formatCatalogEntry('chirp')?.exportStatus).toBe('shipped');
    const adapter = getExportAdapter('chirp');
    expect(isSingleFileCpsExportAdapter(adapter)).toBe(true);
  });

  it.each(CHIRP_GOLDEN_FIXTURES)(
    'constructed library + build matches $fileName (except Location, Comment)',
    ({ profileId, fileName }) => {
      const fixtureCsv = readFileSync(join(fixtureDir, fileName), 'utf8');
      const { library, build } = libraryAndBuildFromChirpFixture(fixtureCsv, profileId);

      const result = exportBuildSingleFile({
        build,
        library,
        options: { profileId, shortenNames: false },
      });

      const comparison = compareCsvRecords(fixtureCsv, result.content, {
        excludeColumns: ['Location', 'Comment'],
      });

      expect(
        comparison.ok,
        formatCsvRecordCompareFailure(comparison) ||
          `records: ${comparison.originalCount} → ${comparison.exportedCount}`,
      ).toBe(true);
      expect(comparison.originalCount).toBe(comparison.exportedCount);
    },
  );
});

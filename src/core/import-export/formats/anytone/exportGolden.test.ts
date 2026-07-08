import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatCatalogEntry, getExportAdapter } from '@core/import-export/registry.ts';
import { isMultiFileExportAdapter } from '@core/import-export/exportAdapter.ts';
import { ANYTONE_EXPORT_FILE_NAMES } from './columns.ts';
import { serialiseAnytoneLstManifest } from './lstManifest.ts';
import { exportBuildAll, exportBuildZip, listExportBuildFileNames } from '@core/services/exportBuild.ts';
import {
  compareCsvRecords,
  formatCsvRecordCompareFailure,
} from '../../../../test/csvRecordCompare.ts';
import { minimalAnytoneExportBuild, minimalAnytoneExportLibrary } from './exportGoldenFixtures.ts';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__/export');

/** Every non-empty line must be comma-separated fields each wrapped in double quotes. */
const UNIVERSALLY_QUOTED_LINE = /^("[^"]*")(,"[^"]*")*$/;

export function assertUniversallyQuotedCsv(text: string): void {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  for (const line of lines) {
    expect(line, `line not universally quoted: ${line.slice(0, 80)}`).toMatch(
      UNIVERSALLY_QUOTED_LINE,
    );
  }
}

/**
 * Excluded from row compare: No. (slot assignment), unmodelled Channel.CSV defaults.
 * See docs/reference/anytone/channels.md.
 */
const CHANNEL_EXCLUDE_COLUMNS = [
  'No.',
  'Busy Lock/TX Permit',
  'Squelch Mode',
  'Optional Signal',
  'DTMF ID',
  '2Tone ID',
  '5Tone ID',
  'PTT ID',
  'TX Prohibit',
  'Reverse',
  'Simplex TDMA',
  'Slot Suit',
  'AES Digital Encryption',
  'Digital Encryption',
  'Call Confirmation',
  'Talk Around',
  'Work Alone',
  'Custom CTCSS',
  '2TONE Decode',
  '5TONE Decode',
  'Display PTT ID',
  'Auto Scan',
  'AM Channel',
  'Analog Signal',
  'Digital Signal',
  'Emg System',
  'Emg Style',
  'Emg Contact',
  'Emg System Alias',
  'Contact/Talk Group Decode',
  'Ranging',
  'SMS',
  'APRS',
  'Optional Signal/DTMF Decode',
  'Quick Message',
  'Voice Encryption',
  'Optional Signal/DTMF ID',
  'Customizable',
  'Comment',
  'GPS',
  'Send GPS Info',
  'Receive GPS Info',
  'Channel Marker',
  'Channel Marker Color',
  'Hot Key',
  'Hot Key Mask',
  'Hot Key Mask2',
  'Hot Key Mask3',
  'Hot Key Mask4',
  'Hot Key Mask5',
  'Hot Key Mask6',
  'Hot Key Mask7',
  'Hot Key Mask8',
];

describe('anytone/export golden', () => {
  it('registry exposes shipped multi-file CPS export adapter', () => {
    expect(formatCatalogEntry('anytone')?.exportStatus).toBe('shipped');
    const adapter = getExportAdapter('anytone');
    expect(isMultiFileExportAdapter(adapter)).toBe(true);
    if (isMultiFileExportAdapter(adapter)) {
      expect(adapter.status).toBe('shipped');
      expect(adapter.fileNames).toContain('Channel.CSV');
      expect(adapter.fileNames).toContain('DMRZone.CSV');
    }
  });

  it('minimal export uses universal double-quoting on all CPS files', () => {
    const library = minimalAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const result = exportBuildAll({ build, library });

    for (const fileName of ANYTONE_EXPORT_FILE_NAMES) {
      const content = result.files[fileName];
      expect(content, `missing export file ${fileName}`).toBeDefined();
      assertUniversallyQuotedCsv(content!);
    }
  });

  it('minimal library + build matches golden Channel.CSV (modelled columns)', () => {
    const library = minimalAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const fixtureCsv = readFileSync(join(fixtureDir, 'Channel.CSV'), 'utf8');
    const result = exportBuildAll({ build, library });

    const comparison = compareCsvRecords(fixtureCsv, result.files['Channel.CSV']!, {
      nameColumn: 'Channel Name',
      excludeColumns: CHANNEL_EXCLUDE_COLUMNS,
    });

    expect(
      comparison.ok,
      formatCsvRecordCompareFailure(comparison) ||
        `records: ${comparison.originalCount} → ${comparison.exportedCount}`,
    ).toBe(true);
    expect(comparison.originalCount).toBe(comparison.exportedCount);
  });

  it('minimal library + build matches golden DMRZone.CSV', () => {
    const library = minimalAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const fixtureCsv = readFileSync(join(fixtureDir, 'DMRZone.CSV'), 'utf8');
    const result = exportBuildAll({ build, library });

    const comparison = compareCsvRecords(fixtureCsv, result.files['DMRZone.CSV']!, {
      nameColumn: 'Zone Name',
    });

    expect(
      comparison.ok,
      formatCsvRecordCompareFailure(comparison) ||
        `records: ${comparison.originalCount} → ${comparison.exportedCount}`,
    ).toBe(true);
    expect(comparison.originalCount).toBe(comparison.exportedCount);
  });

  it('minimal library + build matches golden ScanList.CSV', () => {
    const library = minimalAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const fixtureCsv = readFileSync(join(fixtureDir, 'ScanList.CSV'), 'utf8');
    const result = exportBuildAll({ build, library });

    const comparison = compareCsvRecords(fixtureCsv, result.files['ScanList.CSV']!, {
      nameColumn: 'Scan List Name',
      sortColumnPattern: /^Channel \d+$/,
    });

    expect(
      comparison.ok,
      formatCsvRecordCompareFailure(comparison) ||
        `records: ${comparison.originalCount} → ${comparison.exportedCount}`,
    ).toBe(true);
    expect(comparison.originalCount).toBe(comparison.exportedCount);
  });

  it('includes project LST manifest when projectName is set', () => {
    const library = minimalAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const options = { projectName: 'meep' };
    const result = exportBuildAll({ build, library, options });

    const expectedLst = serialiseAnytoneLstManifest([...ANYTONE_EXPORT_FILE_NAMES]);
    expect(result.files['meep.LST']).toBe(expectedLst);
    expect(listExportBuildFileNames({ build, library, options })).toContain('meep.LST');

    const zipped = exportBuildZip({ build, library, options });
    expect(zipped.files['meep.LST']).toBe(expectedLst);
    expect(zipped.zip.length).toBeGreaterThan(0);
  });
});

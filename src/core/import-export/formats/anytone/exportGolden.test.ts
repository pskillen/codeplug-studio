import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatCatalogEntry, getExportAdapter } from '@core/import-export/registry.ts';
import { isMultiFileExportAdapter } from '@core/import-export/exportAdapter.ts';
import { ANYTONE_EXPORT_FILE_NAMES } from './columns.ts';
import { serialiseAnytoneLstManifest } from './lstManifest.ts';
import {
  exportBuildAll,
  exportBuildZip,
  listExportBuildFileNames,
} from '@core/services/exportBuild.ts';
import {
  compareCsvRecords,
  formatCsvRecordCompareFailure,
} from '../../../../test/csvRecordCompare.ts';
import { parseCsv } from '@core/import-export/csvParse.ts';
import {
  aprsAmAirSlotExportBuild,
  aprsAmAirSlotExportLibrary,
  aprsEnabledAnytoneExportLibrary,
  minimalAnytoneExportBuild,
  minimalAnytoneExportLibrary,
} from './exportGoldenFixtures.ts';
import { APRS_HEADERS } from './columns.ts';

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
 * See docs/reference/export-formats/anytone/channels.md.
 */
const CHANNEL_EXCLUDE_COLUMNS = [
  'No.',
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

/** Modelled APRS.CSV columns — remainder are fixture defaults (see docs/reference/export-formats/anytone/aprs.md). */
const APRS_MODELED_COLUMNS = new Set([
  'Manual TX Interval[s]',
  'APRS Auto TX Interval[s]',
  'Fixed Location Beacon',
  'LatiDegree',
  'LatiMinInt',
  'LatiMinMark',
  'North or South',
  'LongtiDegree',
  'LongtiMinInt',
  'LongtiMinMark',
  'East or West Hemisphere',
  'channel1',
  'slot1',
  'Aprs Tg1',
  'Call Type1',
  'channel2',
  'slot2',
  'Aprs Tg2',
  'Call Type2',
  'channel3',
  'slot3',
  'Aprs Tg3',
  'Call Type3',
  'channel4',
  'slot4',
  'Aprs Tg4',
  'Call Type4',
  'channel5',
  'slot5',
  'Aprs Tg5',
  'Call Type5',
  'channel6',
  'slot6',
  'Aprs Tg6',
  'Call Type6',
  'channel7',
  'slot7',
  'Aprs Tg7',
  'Call Type7',
  'channel8',
  'slot8',
  'Aprs Tg8',
  'Call Type8',
]);

const APRS_EXCLUDE_COLUMNS = APRS_HEADERS.map((header) => header.replace(/"/g, '')).filter(
  (header) => !APRS_MODELED_COLUMNS.has(header),
);

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

  it('minimal export omits APRS.CSV when no aprs configuration', () => {
    const library = minimalAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const result = exportBuildAll({ build, library });

    expect(result.files['APRS.CSV']).toBeUndefined();
    expect(listExportBuildFileNames({ build, library })).not.toContain('APRS.CSV');
  });

  it('APRS-enabled export includes APRS.CSV with modelled columns', () => {
    const library = aprsEnabledAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const fixtureCsv = readFileSync(join(fixtureDir, 'APRS.CSV'), 'utf8');
    const result = exportBuildAll({ build, library });

    expect(result.files['APRS.CSV']).toBeDefined();
    assertUniversallyQuotedCsv(result.files['APRS.CSV']!);
    expect(listExportBuildFileNames({ build, library })).toContain('APRS.CSV');

    const comparison = compareCsvRecords(fixtureCsv, result.files['APRS.CSV']!, {
      nameColumn: 'Manual TX Interval[s]',
      excludeColumns: APRS_EXCLUDE_COLUMNS,
    });

    expect(
      comparison.ok,
      formatCsvRecordCompareFailure(comparison) ||
        `records: ${comparison.originalCount} → ${comparison.exportedCount}`,
    ).toBe(true);
    expect(comparison.originalCount).toBe(1);

    const aprsParsed = parseCsv(result.files['APRS.CSV']!);
    const aprsHeaders = aprsParsed[0]!;
    const aprsRow = aprsParsed[1]!;
    expect(aprsRow[aprsHeaders.indexOf('APRS Auto TX Interval[s]')]).toBe('9');
  });

  it('APRS-enabled export maps Channel.aprs on Channel.CSV', () => {
    const library = aprsEnabledAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const result = exportBuildAll({ build, library });
    const parsed = parseCsv(result.files['Channel.CSV']!);
    const headers = parsed[0]!;
    const rows = parsed.slice(1);
    const nameIndex = headers.indexOf('Channel Name');
    const ch1 = rows.find((row) => row[nameIndex] === 'Channel 1');
    expect(ch1).toBeDefined();
    expect(ch1![headers.indexOf('APRS RX')]).toBe('On');
    expect(ch1![headers.indexOf('APRS Report Type')]).toBe('Digital');
    expect(ch1![headers.indexOf('Digital APRS PTT Mode')]).toBe('On');
    expect(ch1![headers.indexOf('Digital APRS Report Channel')]).toBe('1');
  });

  it('APRS slot bound to AM air channel exports matching AMAir.CSV No.', () => {
    const library = aprsAmAirSlotExportLibrary();
    const build = aprsAmAirSlotExportBuild(library);
    const result = exportBuildAll({ build, library });

    expect(result.files['AMAir.CSV']).toBeDefined();
    expect(result.files['APRS.CSV']).toBeDefined();
    expect(result.files['Channel.CSV']).toBeDefined();

    const amAirParsed = parseCsv(result.files['AMAir.CSV']!);
    const amAirHeaders = amAirParsed[0]!;
    const amAirRow = amAirParsed[1]!;
    const amAirNo = amAirRow[amAirHeaders.indexOf('No.')];

    const aprsParsed = parseCsv(result.files['APRS.CSV']!);
    const aprsHeaders = aprsParsed[0]!;
    const aprsRow = aprsParsed[1]!;

    expect(aprsRow[aprsHeaders.indexOf('channel1')]).toBe(amAirNo);
    expect(aprsRow[aprsHeaders.indexOf('slot1')]).toBe('1');
    expect(aprsRow[aprsHeaders.indexOf('Aprs Tg1')]).toBe('2355');
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

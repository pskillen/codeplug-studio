import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatCatalogEntry, getExportAdapter } from '@core/import-export/registry.ts';
import { isMultiFileExportAdapter } from '@core/import-export/exportAdapter.ts';
import { exportBuildAll } from '@core/services/exportBuild.ts';
import { serialiseOpenGd77Files } from './serialise.ts';
import { CHANNEL_COL } from './columns.ts';
import { parseCsv } from '@core/import-export/csvParse.ts';
import {
  compareCsvRecords,
  formatCsvRecordCompareFailure,
} from '../../../../test/csvRecordCompare.ts';
import {
  assembleOpenGd77YamlGolden,
  loadOpenGd77YamlGoldenFixture,
  multiModeOpenGd77ExportBuild,
  multiModeOpenGd77ExportLibrary,
  shorteningOpenGd77ExportBuild,
  shorteningOpenGd77ExportLibrary,
} from './exportGoldenFixtures.ts';
import { OPENGD77_EXPORT_FILE_NAMES } from './adapter.ts';

const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__/export');

function compareGoldenCsv(
  fixtureName: string,
  exported: string,
  options: Parameters<typeof compareCsvRecords>[2],
): void {
  const fixtureCsv = readFileSync(join(fixtureDir, fixtureName), 'utf8');
  const comparison = compareCsvRecords(fixtureCsv, exported, options);
  expect(
    comparison.ok,
    formatCsvRecordCompareFailure(comparison) ||
      `${fixtureName}: ${comparison.originalCount} → ${comparison.exportedCount}`,
  ).toBe(true);
  expect(comparison.originalCount).toBe(comparison.exportedCount);
}

describe('opengd77/export golden', () => {
  it('registry exposes shipped multi-file CPS export adapter', () => {
    expect(formatCatalogEntry('opengd77')?.exportStatus).toBe('shipped');
    const adapter = getExportAdapter('opengd77');
    expect(isMultiFileExportAdapter(adapter)).toBe(true);
    if (isMultiFileExportAdapter(adapter)) {
      expect(adapter.status).toBe('shipped');
      expect(adapter.fileNames).toEqual([...OPENGD77_EXPORT_FILE_NAMES]);
    }
  });

  it('yaml fixture library + build matches golden Channels.csv', () => {
    const { build, egress, library } = loadOpenGd77YamlGoldenFixture();
    const result = exportBuildAll({ build, egress, library });
    compareGoldenCsv('Channels.csv', result.files['Channels.csv']!, {
      nameColumn: CHANNEL_COL.name,
    });
  });

  it('yaml fixture library + build matches golden Zones.csv', () => {
    const { build, egress, library } = loadOpenGd77YamlGoldenFixture();
    const result = exportBuildAll({ build, egress, library });
    compareGoldenCsv('Zones.csv', result.files['Zones.csv']!, {
      nameColumn: 'Zone Name',
      sortColumnPattern: /^Channel \d+$/,
    });
  });

  it('yaml fixture library + build matches golden Contacts.csv', () => {
    const { build, egress, library } = loadOpenGd77YamlGoldenFixture();
    const result = exportBuildAll({ build, egress, library });
    compareGoldenCsv('Contacts.csv', result.files['Contacts.csv']!, {
      nameColumn: 'Contact Name',
    });
  });

  it('yaml fixture library + build matches golden TG_Lists.csv', () => {
    const { build, egress, library } = loadOpenGd77YamlGoldenFixture();
    const result = exportBuildAll({ build, egress, library });
    compareGoldenCsv('TG_Lists.csv', result.files['TG_Lists.csv']!, {
      nameColumn: 'TG List Name',
      sortColumnPattern: /^Contact\d+$/,
    });
  });

  it('emits CPS-safe unmodelled defaults on digital channel rows', () => {
    const { build, library } = loadOpenGd77YamlGoldenFixture();
    const assembled = assembleOpenGd77YamlGolden(library, build);
    const csv = serialiseOpenGd77Files(assembled, { profileId: 'opengd77-1701' })['Channels.csv'];
    const rows = parseCsv(csv);
    const headers = rows[0]!;
    const digitalRow = rows.find((row) => row[headers.indexOf(CHANNEL_COL.type)] === 'Digital');
    expect(digitalRow).toBeDefined();
    expect(digitalRow![headers.indexOf(CHANNEL_COL.zoneSkip)]).toBe('No');
    expect(digitalRow![headers.indexOf(CHANNEL_COL.noBeep)]).toBe('No');
    expect(digitalRow![headers.indexOf(CHANNEL_COL.noEco)]).toBe('No');
    expect(digitalRow![headers.indexOf(CHANNEL_COL.ts1TaTx)]).toBe('Off');
    expect(digitalRow![headers.indexOf(CHANNEL_COL.ts2TaTxId)]).toBe('Off');
  });

  it('expands multi-mode channels into -F and -D wire rows', () => {
    const base = loadOpenGd77YamlGoldenFixture();
    const library = multiModeOpenGd77ExportLibrary(base.library);
    const build = multiModeOpenGd77ExportBuild(library);
    const assembled = assembleOpenGd77YamlGolden(library, build);
    const csv = serialiseOpenGd77Files(assembled, {
      profileId: 'opengd77-1701',
      expandModes: true,
    })['Channels.csv'];
    expect(csv).toContain('-F');
    expect(csv).toContain('-D');
  });

  it('shortens long talk group names in Contacts.csv when shortenNames is enabled', () => {
    const base = loadOpenGd77YamlGoldenFixture();
    const library = shorteningOpenGd77ExportLibrary(base.library);
    const build = shorteningOpenGd77ExportBuild(library);
    const assembled = assembleOpenGd77YamlGolden(library, build);
    const csv = serialiseOpenGd77Files(assembled, {
      profileId: 'opengd77-1701',
      shortenNames: true,
    })['Contacts.csv'];
    const rows = parseCsv(csv);
    const headers = rows[0]!;
    const nameIdx = headers.indexOf('Contact Name');
    const groupRows = rows.slice(1).filter((row) => row[headers.indexOf('ID Type')] === 'Group');
    expect(groupRows.some((row) => row[nameIdx] === 'Scot West TS2')).toBe(true);
    expect(groupRows.every((row) => (row[nameIdx]?.length ?? 0) <= 16)).toBe(true);
  });
});

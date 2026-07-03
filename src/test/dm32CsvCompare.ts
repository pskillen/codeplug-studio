import {
  CHANNEL_COL,
  CONTACT_COL,
  DTMF_CONTACT_COL,
  RX_GROUP_LIST_COL,
  SCAN_COL,
  TALKGROUP_COL,
  ZONE_COL,
  type Dm32ExportFileName,
} from '@core/import-export/formats/dm32/columns.ts';
import {
  compareCsvRecords,
  type CsvRecordCompareOptions,
  type CsvRecordCompareResult,
} from './csvRecordCompare.ts';
import { parseCsv } from './csvParse.ts';

/** Six core DM32 CPS files plus optional Scan.csv (omitted when no scan lists export). */
export const DM32_CORE_EXPORT_FILES = [
  'Channels.csv',
  'Zones.csv',
  'Talkgroups.csv',
  'Contacts.csv',
  'RXGroupLists.csv',
  'DTMFContacts.csv',
] as const;

export interface Dm32FileCompareSpec {
  nameColumn: string;
  excludeColumns?: string[];
  sortColumnPattern?: RegExp;
}

/** Per-file compare options for DM32 export mapping tests. */
export const DM32_EXPORT_COMPARE_SPECS: Record<string, Dm32FileCompareSpec> = {
  'Channels.csv': {
    nameColumn: CHANNEL_COL.name,
    excludeColumns: [
      CHANNEL_COL.number,
      CHANNEL_COL.scanList,
      CHANNEL_COL.dmrIdLabel,
      CHANNEL_COL.squelch,
      CHANNEL_COL.aprsReportType,
      CHANNEL_COL.aprsReceive,
      CHANNEL_COL.aprsReportChannel,
      CHANNEL_COL.forbidTx,
    ],
  },
  'Zones.csv': {
    nameColumn: ZONE_COL.name,
    excludeColumns: [ZONE_COL.number],
    sortColumnPattern: /Channel Members/,
  },
  'Talkgroups.csv': {
    nameColumn: TALKGROUP_COL.name,
    excludeColumns: [TALKGROUP_COL.number],
  },
  'Contacts.csv': {
    nameColumn: CONTACT_COL.id,
    excludeColumns: [CONTACT_COL.number],
  },
  'RXGroupLists.csv': {
    nameColumn: RX_GROUP_LIST_COL.name,
    excludeColumns: [RX_GROUP_LIST_COL.number],
    sortColumnPattern: /Contact Members/,
  },
  'DTMFContacts.csv': {
    nameColumn: DTMF_CONTACT_COL.name,
    excludeColumns: [DTMF_CONTACT_COL.number],
  },
  'Scan.csv': {
    nameColumn: SCAN_COL.name,
    excludeColumns: [SCAN_COL.number],
    sortColumnPattern: /Channel Members/,
  },
};

export function compareDm32ExportFile(
  fileName: string,
  originalCsv: string,
  exportedCsv: string,
  overrides: Partial<CsvRecordCompareOptions> = {},
): CsvRecordCompareResult {
  const spec = DM32_EXPORT_COMPARE_SPECS[fileName];
  if (!spec) {
    throw new Error(`No DM32 compare spec for ${fileName}`);
  }
  return compareCsvRecords(originalCsv, exportedCsv, {
    nameColumn: spec.nameColumn,
    excludeColumns: spec.excludeColumns,
    sortColumnPattern: spec.sortColumnPattern,
    ...overrides,
  });
}

export interface Dm32BundleCompareResult {
  ok: boolean;
  failures: Array<{ fileName: string; result: CsvRecordCompareResult }>;
}

export function compareDm32ExportBundle(
  expected: Record<string, string>,
  exported: Record<string, string>,
  fileNames: readonly string[] = DM32_CORE_EXPORT_FILES,
): Dm32BundleCompareResult {
  const failures: Dm32BundleCompareResult['failures'] = [];
  for (const fileName of fileNames) {
    const originalCsv = expected[fileName];
    const exportedCsv = exported[fileName as Dm32ExportFileName];
    if (!originalCsv || exportedCsv === undefined) {
      failures.push({
        fileName,
        result: {
          ok: false,
          originalCount: originalCsv ? 1 : 0,
          exportedCount: exportedCsv ? 1 : 0,
          fieldDiffs: [],
          missingInExport: ['missing file'],
          missingInOriginal: [],
        },
      });
      continue;
    }
    const result = compareDm32ExportFile(fileName, originalCsv, exportedCsv);
    if (!result.ok) {
      failures.push({ fileName, result });
    }
  }
  return { ok: failures.length === 0, failures };
}

/** Compare header rows only — useful against full v1.60 fixtures without import. */
export function compareCsvHeaders(originalCsv: string, exportedCsv: string): boolean {
  const originalRows = parseCsv(originalCsv.replace(/^\uFEFF/, '').trim());
  const exportedRows = parseCsv(exportedCsv.replace(/^\uFEFF/, '').trim());
  if (!originalRows.length || !exportedRows.length) return false;
  const originalHeader = originalRows[0].map((h) => h.trim()).join(',');
  const exportedHeader = exportedRows[0].map((h) => h.trim()).join(',');
  return originalHeader === exportedHeader;
}

export function formatDm32BundleCompareFailure(result: Dm32BundleCompareResult): string {
  return result.failures
    .map(({ fileName, result: compare }) => {
      const lines = [`${fileName}:`];
      if (compare.missingInExport.length) {
        lines.push(`  missing in export: ${compare.missingInExport.length}`);
        /* eslint-disable no-control-regex */
        lines.push(`  e.g. ${compare.missingInExport[0]?.replace(/\u0001/g, ' | ')}`);
        /* eslint-enable no-control-regex */
      }
      if (compare.missingInOriginal.length) {
        lines.push(`  extra in export: ${compare.missingInOriginal.length}`);
      }
      for (const diff of compare.fieldDiffs.slice(0, 5)) {
        lines.push(
          `  ${diff.column}: ${JSON.stringify(diff.original)} → ${JSON.stringify(diff.exported)}`,
        );
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

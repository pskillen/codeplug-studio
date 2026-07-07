import { parseCsv } from '@core/import-export/csvParse.ts';

export interface CsvRecordCompareOptions {
  nameColumn?: string;
  excludeColumns?: string[];
  normalizeColumn?: Record<string, (value: string) => string>;
  sortColumnPattern?: RegExp;
}

export interface CsvFieldDiff {
  signature: string;
  column: string;
  original: string;
  exported: string;
}

export interface CsvRecordCompareResult {
  ok: boolean;
  originalCount: number;
  exportedCount: number;
  fieldDiffs: CsvFieldDiff[];
  missingInExport: string[];
  missingInOriginal: string[];
}

function rowParts(
  row: string[],
  headers: string[],
  exclude: Set<string>,
  normalizeColumn?: Record<string, (value: string) => string>,
  sortColumnPattern?: RegExp,
): string[] {
  const parts: string[] = [];
  const sortableIndices: number[] = [];
  for (let index = 0; index < headers.length; index++) {
    const header = headers[index]!;
    if (exclude.has(header)) continue;
    let value = (row[index] ?? '').trim();
    const normalize = normalizeColumn?.[header];
    if (normalize) value = normalize(value);
    if (sortColumnPattern?.test(header)) sortableIndices.push(parts.length);
    parts.push(value);
  }
  if (sortableIndices.length > 1) {
    const sorted = sortableIndices.map((i) => parts[i]!).sort();
    sortableIndices.forEach((partIndex, i) => {
      parts[partIndex] = sorted[i]!;
    });
  }
  return parts;
}

function rowSignature(parts: string[]): string {
  return parts.join('\u0001');
}

function fieldDiffFromSignatures(
  originalSig: string,
  exportedSig: string,
  headers: string[],
  exclude: Set<string>,
): CsvFieldDiff[] {
  const compareHeaders = headers.filter((h) => !exclude.has(h));
  const originalParts = originalSig.split('\u0001');
  const exportedParts = exportedSig.split('\u0001');
  const diffs: CsvFieldDiff[] = [];
  for (let i = 0; i < compareHeaders.length; i++) {
    const original = originalParts[i] ?? '';
    const exported = exportedParts[i] ?? '';
    if (original !== exported) {
      diffs.push({
        signature: originalSig,
        column: compareHeaders[i]!,
        original,
        exported,
      });
    }
  }
  return diffs;
}

function multisetDiff(a: string[], b: string[]): string[] {
  const remaining = [...b];
  const missing: string[] = [];
  for (const item of a) {
    const index = remaining.indexOf(item);
    if (index >= 0) {
      remaining.splice(index, 1);
    } else {
      missing.push(item);
    }
  }
  return missing;
}

/** Compare two CSV files as multisets of named records (row order ignored). */
export function compareCsvRecords(
  originalCsv: string,
  exportedCsv: string,
  options: CsvRecordCompareOptions = {},
): CsvRecordCompareResult {
  const exclude = new Set(options.excludeColumns ?? []);
  const nameColumn = options.nameColumn ?? 'Name';
  const normalizeColumn = options.normalizeColumn;
  const sortColumnPattern = options.sortColumnPattern;

  const originalRows = parseCsv(originalCsv.replace(/^\uFEFF/, '').trim());
  const exportedRows = parseCsv(exportedCsv.replace(/^\uFEFF/, '').trim());
  if (!originalRows.length || !exportedRows.length) {
    throw new Error('CSV must include a header row');
  }

  const headers = originalRows[0].map((h) => h.trim());
  const exportedHeaders = exportedRows[0].map((h) => h.trim());
  if (headers.join(',') !== exportedHeaders.join(',')) {
    throw new Error('Header row mismatch between original and exported CSV');
  }

  const nameIdx = headers.indexOf(nameColumn);
  if (nameIdx < 0) throw new Error(`Missing key column: ${nameColumn}`);

  function namedRowSignatures(rows: string[][]): string[] {
    const signatures: string[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const name = (row[nameIdx] ?? '').trim();
      if (!name) continue;
      signatures.push(
        rowSignature(rowParts(row, headers, exclude, normalizeColumn, sortColumnPattern)),
      );
    }
    return signatures.sort();
  }

  const originalSignatures = namedRowSignatures(originalRows);
  const exportedSignatures = namedRowSignatures(exportedRows);

  const missingInExport = multisetDiff(originalSignatures, exportedSignatures);
  const missingInOriginal = multisetDiff(exportedSignatures, originalSignatures);

  const fieldDiffs: CsvFieldDiff[] = [];
  if (missingInExport.length === 1 && missingInOriginal.length === 1) {
    fieldDiffs.push(
      ...fieldDiffFromSignatures(missingInExport[0]!, missingInOriginal[0]!, headers, exclude),
    );
  }

  return {
    ok: missingInExport.length === 0 && missingInOriginal.length === 0 && fieldDiffs.length === 0,
    originalCount: originalSignatures.length,
    exportedCount: exportedSignatures.length,
    missingInExport,
    missingInOriginal,
    fieldDiffs,
  };
}

export function formatCsvRecordCompareFailure(result: CsvRecordCompareResult): string {
  const lines: string[] = [];
  if (result.originalCount !== result.exportedCount) {
    lines.push(`Record count: ${result.originalCount} original → ${result.exportedCount} exported`);
  }
  /* eslint-disable no-control-regex */
  if (result.missingInExport.length) {
    lines.push(`Unmatched original rows: ${result.missingInExport.length}`);
    lines.push(`  e.g. ${result.missingInExport[0]?.replace(/\u0001/g, ' | ')}`);
  }
  if (result.missingInOriginal.length) {
    lines.push(`Unmatched exported rows: ${result.missingInOriginal.length}`);
    lines.push(`  e.g. ${result.missingInOriginal[0]?.replace(/\u0001/g, ' | ')}`);
  }
  /* eslint-enable no-control-regex */
  for (const diff of result.fieldDiffs.slice(0, 10)) {
    lines.push(
      `${diff.column}: ${JSON.stringify(diff.original)} → ${JSON.stringify(diff.exported)}`,
    );
  }
  return lines.join('\n');
}

/** Anytone CPS CSV writer — universal double-quoting; strips embedded `"` on export. */

/** AT-D890UV CPS on Windows expects CRLF; Studio export matches official CPS bundles. */
export const ANYTONE_CSV_LINE_ENDING = '\r\n';

/** Remove double quotes from wire values (Anytone CPS does not use RFC 4180 escaping). */
export function sanitizeCsvFieldValue(value: string): string {
  return value.replace(/"/g, '');
}

/** Wrap every field in double quotes after sanitizing embedded quotes. */
export function escapeCsvField(value: string): string {
  return `"${sanitizeCsvFieldValue(value)}"`;
}

export function formatCsvRow(fields: string[]): string {
  return fields.map((f) => escapeCsvField(f)).join(',');
}

export function formatCsv(headers: string[], rows: string[][]): string {
  const lines = [formatCsvRow(headers), ...rows.map((row) => formatCsvRow(row))];
  return `${lines.join(ANYTONE_CSV_LINE_ENDING)}${ANYTONE_CSV_LINE_ENDING}`;
}

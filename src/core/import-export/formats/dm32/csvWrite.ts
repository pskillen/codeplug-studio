/** DM32 CPS CSV writer — RFC 4180 escaping via OpenGD77 helpers; CRLF line endings for Windows CPS. */

/** Baofeng DM-32UV CPS on Windows expects CRLF; Studio export matches official CPS bundles. */
export const DM32_CSV_LINE_ENDING = '\r\n';

export { escapeCsvField, formatCsvRow } from '../opengd77/csvWrite.ts';

import { formatCsvRow } from '../opengd77/csvWrite.ts';

export function formatCsv(headers: string[], rows: string[][]): string {
  const lines = [formatCsvRow(headers), ...rows.map((row) => formatCsvRow(row))];
  return `${lines.join(DM32_CSV_LINE_ENDING)}${DM32_CSV_LINE_ENDING}`;
}

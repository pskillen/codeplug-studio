import type { VerifyDiagnostic } from '../types.ts';

/**
 * Anytone CPS requires every CSV field (including header) to be double-quoted.
 * Embedded `"` inside field bodies are not allowed (Studio strips them on export).
 */
export function checkUniversalQuoting(fileName: string, text: string): VerifyDiagnostic[] {
  const diagnostics: VerifyDiagnostic[] = [];
  // Work line-by-line with CRLF or LF split for messaging; quoting check is per logical line
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  // Drop trailing empty line from final newline
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!;
    if (line.length === 0) continue;
    const rowLabel = lineIndex === 0 ? 0 : lineIndex; // header row reported as row 0
    const fields = splitQuotedCsvLine(line);
    if (fields == null) {
      diagnostics.push({
        rule: 'quoting',
        file: fileName,
        row: rowLabel,
        message: 'Line is not fully double-quoted CSV (parse failed).',
      });
      continue;
    }
    for (let f = 0; f < fields.length; f++) {
      const raw = fields[f]!;
      if (!raw.startsWith('"') || !raw.endsWith('"') || raw.length < 2) {
        diagnostics.push({
          rule: 'quoting',
          file: fileName,
          row: rowLabel,
          message: `Field ${f + 1} is not wrapped in double quotes.`,
        });
        continue;
      }
      const inner = raw.slice(1, -1);
      if (inner.includes('"')) {
        diagnostics.push({
          rule: 'escaping',
          file: fileName,
          row: rowLabel,
          message: `Field ${f + 1} contains embedded double quotes (Anytone strips '"' rather than RFC 4180 escaping).`,
        });
      }
    }
  }
  return diagnostics;
}

/**
 * Split a line into raw field tokens including surrounding quotes.
 * Returns null if the line does not follow universal-quoting shape.
 */
export function splitQuotedCsvLine(line: string): string[] | null {
  const fields: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] !== '"') {
      // Unquoted field start — capture until comma for diagnostic context
      let end = i;
      while (end < line.length && line[end] !== ',') end++;
      fields.push(line.slice(i, end));
      if (end < line.length && line[end] === ',') {
        i = end + 1;
        continue;
      }
      break;
    }
    // Quoted field
    let j = i + 1;
    while (j < line.length) {
      if (line[j] === '"') {
        if (line[j + 1] === '"') {
          j += 2;
          continue;
        }
        break;
      }
      j++;
    }
    if (j >= line.length || line[j] !== '"') {
      return null;
    }
    fields.push(line.slice(i, j + 1));
    i = j + 1;
    if (i < line.length) {
      if (line[i] !== ',') return null;
      i++;
    }
  }
  return fields;
}

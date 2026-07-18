import type { VerifyDiagnostic } from '../types.ts';

/**
 * RFC 4180-style selective quoting: unquoted fields must not contain comma,
 * quote, or newline; quoted fields use "" for embedded quotes.
 * Does not require universal quoting (unlike Anytone).
 */
export function checkSelectiveQuoting(fileName: string, text: string): VerifyDiagnostic[] {
  const diagnostics: VerifyDiagnostic[] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!;
    if (line.length === 0) continue;
    const rowLabel = lineIndex;
    const parsed = parseSelectiveCsvLine(line);
    if (parsed == null) {
      diagnostics.push({
        rule: 'quoting',
        file: fileName,
        row: rowLabel,
        message: 'CSV line could not be parsed (quoting / field structure).',
      });
    }
  }
  return diagnostics;
}

/** Returns field values or null if the line is malformed. */
export function parseSelectiveCsvLine(line: string): string[] | null {
  const fields: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      fields.push('');
      break;
    }
    if (line[i] === '"') {
      let j = i + 1;
      let value = '';
      while (j < line.length) {
        if (line[j] === '"') {
          if (line[j + 1] === '"') {
            value += '"';
            j += 2;
            continue;
          }
          break;
        }
        value += line[j];
        j++;
      }
      if (j >= line.length || line[j] !== '"') return null;
      fields.push(value);
      i = j + 1;
      if (i < line.length) {
        if (line[i] !== ',') return null;
        i++;
        if (i === line.length) fields.push('');
      }
      continue;
    }
    // Unquoted field
    let end = i;
    while (end < line.length && line[end] !== ',') end++;
    const raw = line.slice(i, end);
    if (/["\n\r]/.test(raw)) return null;
    fields.push(raw);
    i = end;
    if (i < line.length && line[i] === ',') {
      i++;
      if (i === line.length) fields.push('');
    } else {
      break;
    }
  }
  return fields;
}

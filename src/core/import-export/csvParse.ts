/** Minimal RFC 4180-style CSV parser. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface CsvTable {
  headers: string[];
  rows: string[][];
}

/** Parse CSV text into a header row and data rows (first row = headers). */
export function csvToTable(text: string): CsvTable {
  const normalized = text.replace(/^\uFEFF/, '').trim();
  if (!normalized) {
    return { headers: [], rows: [] };
  }
  const parsed = parseCsv(normalized);
  if (parsed.length === 0) {
    return { headers: [], rows: [] };
  }
  const [headers, ...rows] = parsed;
  return { headers, rows };
}

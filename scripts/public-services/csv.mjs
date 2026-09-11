/**
 * Minimal RFC-4180 CSV helpers for the public-service dataset pipeline.
 * Quote a field only when it contains a comma, quote, or newline.
 */

/**
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * @param {string} field
 * @returns {string}
 */
export function encodeCsvField(field) {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replaceAll('"', '""')}"`;
  }
  return field;
}

/**
 * @param {string[][]} rows
 * @returns {string}
 */
export function stringifyCsv(rows) {
  return `${rows.map((row) => row.map(encodeCsvField).join(',')).join('\n')}\n`;
}

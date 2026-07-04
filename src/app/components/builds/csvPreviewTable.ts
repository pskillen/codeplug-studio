export type CsvPreviewSortDirection = 'asc' | 'desc';

export interface CsvPreviewSortState {
  columnIndex: number;
  direction: CsvPreviewSortDirection;
}

/** Case-insensitive substring filter per column (AND across columns). */
export function filterCsvRows(rows: string[][], filters: readonly string[]): string[][] {
  return rows.filter((row) =>
    filters.every((filter, columnIndex) => {
      const needle = filter.trim().toLowerCase();
      if (!needle) return true;
      return (row[columnIndex] ?? '').toLowerCase().includes(needle);
    }),
  );
}

export function sortCsvRows(rows: string[][], sort: CsvPreviewSortState | null): string[][] {
  if (!sort) return rows;
  const multiplier = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((rowA, rowB) => {
    const a = rowA[sort.columnIndex] ?? '';
    const b = rowB[sort.columnIndex] ?? '';
    return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }) * multiplier;
  });
}

export function projectCsvTableRows(
  rows: string[][],
  filters: readonly string[],
  sort: CsvPreviewSortState | null,
): string[][] {
  return sortCsvRows(filterCsvRows(rows, filters), sort);
}

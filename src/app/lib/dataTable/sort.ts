import type { DataTableColumn, DataTableLinkedColumn } from '../../components/ui/DataTable.tsx';

export type DataTableSortDirection = 'asc' | 'desc';

export interface DataTableSortState {
  columnKey: string;
  direction: DataTableSortDirection;
}

export const DATATABLE_NAME_SORT_KEY = '__name__';
export const DATATABLE_CALLSIGN_SORT_KEY = '__callsign__';

export interface DataTableSortContext<T> {
  columns: DataTableColumn<T>[];
  callsignColumn?: DataTableLinkedColumn<T>;
  nameColumn: DataTableLinkedColumn<T>;
}

function getSortValueForKey<T>(
  row: T,
  columnKey: string,
  ctx: DataTableSortContext<T>,
): string | number | null {
  if (columnKey === DATATABLE_NAME_SORT_KEY) {
    if (ctx.nameColumn.sortValue) return ctx.nameColumn.sortValue(row);
    return ctx.nameColumn.getName(row);
  }
  if (columnKey === DATATABLE_CALLSIGN_SORT_KEY && ctx.callsignColumn) {
    if (ctx.callsignColumn.sortValue) return ctx.callsignColumn.sortValue(row);
    return ctx.callsignColumn.getName(row);
  }
  const col = ctx.columns.find((c) => c.key === columnKey);
  if (!col?.sortValue) return null;
  return col.sortValue(row);
}

function compareSortValues(a: string | number | null, b: string | number | null): number {
  const aNull = a === null || a === undefined || a === '';
  const bNull = b === null || b === undefined || b === '';
  if (aNull && bNull) return 0;
  if (aNull) return 1;
  if (bNull) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
}

export function sortDataTableRows<T>(
  rows: T[],
  sortState: DataTableSortState | null | undefined,
  ctx: DataTableSortContext<T>,
): T[] {
  if (!sortState) return rows;
  const { columnKey, direction } = sortState;
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...rows].sort((rowA, rowB) => {
    const a = getSortValueForKey(rowA, columnKey, ctx);
    const b = getSortValueForKey(rowB, columnKey, ctx);
    return compareSortValues(a, b) * multiplier;
  });
}

export function nextSortState(
  current: DataTableSortState | null | undefined,
  columnKey: string,
): DataTableSortState {
  if (current?.columnKey === columnKey) {
    return { columnKey, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { columnKey, direction: 'asc' };
}

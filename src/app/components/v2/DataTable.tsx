import { Loader, TextInput } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react';
import { useMemo, useState, type ReactNode } from 'react';
import { ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './DataTable.module.css';

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** CSS grid track for this column, e.g. `'120px'`. Defaults to `'1fr'`. */
  width?: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null;
  /** Muted/secondary text styling for this cell. */
  dim?: boolean;
}

export type DataTableSortDirection = 'asc' | 'desc';

export interface DataTableSortState {
  key: string;
  direction: DataTableSortDirection;
}

export type DataTableVariant = 'list' | 'embedded';

export interface DataTableSearchConfig {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  pending?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  variant?: DataTableVariant;
  caption?: ReactNode;
  emptyMessage?: ReactNode;
  /** Shown instead of `emptyMessage` when `totalRowCount` indicates rows exist but none match. */
  filteredEmptyMessage?: ReactNode;
  sort?: DataTableSortState | null;
  onSortChange?: (sort: DataTableSortState | null) => void;
  search?: DataTableSearchConfig;
  totalRowCount?: number;
  resultCount?: number;
  countLabel?: (displayed: number, total: number | undefined) => ReactNode;
  className?: string;
}

function compareValues(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function nextSortDirection(
  current: DataTableSortState | null,
  key: string,
): DataTableSortState | null {
  if (current?.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

function defaultCountLabel(displayed: number, total: number | undefined) {
  if (total == null || total === displayed) {
    return `${displayed} result${displayed === 1 ? '' : 's'}`;
  }
  return `Showing ${displayed} of ${total}`;
}

/**
 * Design-system-v2 data table — a fresh Mantine port of the mk2 DS `DataTable`
 * spec, built up across this PR's commits (core → selection/bulk → reorder →
 * nesting/scale/visibility/row-activate). Coexists with the existing
 * `components/ui/DataTable` (reused as-is elsewhere) until a later migration.
 */
export default function DataTable<T>({
  columns,
  rows,
  getRowId,
  variant = 'list',
  caption,
  emptyMessage = 'No items',
  filteredEmptyMessage = 'No matches',
  sort: controlledSort,
  onSortChange,
  search,
  totalRowCount,
  resultCount,
  countLabel = defaultCountLabel,
  className,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<DataTableSortState | null>(null);
  const sortState = controlledSort !== undefined ? controlledSort : internalSort;

  const applySort = (next: DataTableSortState | null) => {
    if (onSortChange) {
      onSortChange(next);
    } else {
      setInternalSort(next);
    }
  };

  const handleSort = (key: string) => {
    applySort(nextSortDirection(sortState, key));
  };

  const sortColumn = sortState ? columns.find((col) => col.key === sortState.key) : undefined;

  const sortedRows = useMemo(() => {
    if (!sortState || !sortColumn?.sortValue) return rows;
    const { sortValue } = sortColumn;
    const direction = sortState.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => direction * compareValues(sortValue(a), sortValue(b)));
  }, [rows, sortState, sortColumn]);

  const displayCount = resultCount ?? sortedRows.length;
  const isFilteredEmpty =
    sortedRows.length === 0 && totalRowCount !== undefined && totalRowCount > 0;
  const showMetaRow = !!search || totalRowCount !== undefined || resultCount !== undefined;

  const gridTemplateColumns = columns.map((col) => col.width ?? '1fr').join(' ');

  return (
    <div className={[classes.root, className].filter(Boolean).join(' ')} data-variant={variant}>
      {search ? (
        <TextInput
          value={search.value}
          onChange={(event) => search.onChange(event.currentTarget.value)}
          placeholder={search.placeholder ?? 'Filter…'}
          rightSection={search.pending ? <Loader size={16} /> : undefined}
          aria-label="Search table"
          className={classes.search}
        />
      ) : null}

      {showMetaRow ? (
        <div className={classes.metaRow}>
          <span className={classes.count}>{countLabel(displayCount, totalRowCount)}</span>
        </div>
      ) : null}

      <div className={classes.table} role="table">
        <div className={classes.headerRow} role="row" style={{ gridTemplateColumns }}>
          {columns.map((col) => {
            const active = sortState?.key === col.key;
            const Icon = active
              ? sortState!.direction === 'asc'
                ? IconChevronUp
                : IconChevronDown
              : IconSelector;
            const sortable = col.sortable !== false && !!col.sortValue;

            return (
              <div
                key={col.key}
                role="columnheader"
                aria-sort={
                  active ? (sortState!.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                }
                className={[classes.headerCell, col.align === 'right' ? classes.alignRight : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {sortable ? (
                  <button
                    type="button"
                    className={classes.sortButton}
                    onClick={() => handleSort(col.key)}
                  >
                    <span>{col.header}</span>
                    <Icon
                      size={14}
                      stroke={ICON_STROKE}
                      className={active ? classes.sortIconActive : classes.sortIcon}
                      aria-hidden
                    />
                  </button>
                ) : (
                  col.header
                )}
              </div>
            );
          })}
        </div>

        <div className={classes.body}>
          {sortedRows.length === 0 ? (
            <div className={classes.emptyRow} role="row">
              <div role="cell" className={classes.emptyCell}>
                {isFilteredEmpty ? filteredEmptyMessage : emptyMessage}
              </div>
            </div>
          ) : (
            sortedRows.map((row) => {
              const key = getRowId(row);
              return (
                <div
                  key={key}
                  role="row"
                  className={classes.dataRow}
                  style={{ gridTemplateColumns }}
                >
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      role="cell"
                      className={[
                        classes.dataCell,
                        col.align === 'right' ? classes.alignRight : '',
                        col.dim ? classes.dim : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {col.render(row)}
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {caption ? <div className={classes.caption}>{caption}</div> : null}
    </div>
  );
}

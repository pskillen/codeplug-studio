import {
  Anchor,
  Checkbox,
  Group,
  Loader,
  MultiSelect,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import EmptyState from './EmptyState.tsx';
import { useDataTableColumnVisibility } from '../../hooks/useDataTableColumnVisibility.ts';
import {
  DATATABLE_CALLSIGN_SORT_KEY,
  DATATABLE_NAME_SORT_KEY,
  nextSortState,
  sortDataTableRows,
  type DataTableSortState,
} from '../../lib/dataTable/sort.ts';
import classes from './DataTable.module.css';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null;
  defaultVisible?: boolean;
  hideable?: boolean;
}

export type DataTableMobileColumnPolicy = 'none' | 'collapse';

export interface DataTableLinkedColumn<T> {
  header?: string;
  getName: (row: T) => string;
  getPath: (row: T) => string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null;
}

export type DataTableVariant = 'list' | 'embedded';

export interface DataTableProps<T> {
  rows: T[];
  rowKey: (row: T) => string;
  callsignColumn?: DataTableLinkedColumn<T>;
  nameColumn: DataTableLinkedColumn<T>;
  columns: DataTableColumn<T>[];
  emptyState?: ReactNode;
  caption?: ReactNode;
  toolbar?: ReactNode;
  variant?: DataTableVariant;
  sort?: DataTableSortState | null;
  onSortChange?: (state: DataTableSortState | null) => void;
  defaultSort?: DataTableSortState;
  search?: string;
  searchPending?: boolean;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  columnVisibility?: string[];
  onColumnVisibilityChange?: (keys: string[]) => void;
  columnVisibilityStorageKey?: string;
  columnVisibilityLoad?: () => string[];
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectedKeysChange?: (keys: string[]) => void;
  filteredEmptyMessage?: string;
  totalRowCount?: number;
  resultCount?: number;
  /** Extension point for #68 mobile column collapse. Only `none` is implemented. */
  mobileColumnPolicy?: DataTableMobileColumnPolicy;
}

function LinkedCell<T>({ column, row }: { column: DataTableLinkedColumn<T>; row: T }) {
  return (
    <Anchor component={Link} to={column.getPath(row)} fw={500}>
      {column.getName(row)}
    </Anchor>
  );
}

function SortableHeader({
  label,
  columnKey,
  sortable,
  sortState,
  onSort,
}: {
  label: string;
  columnKey: string;
  sortable: boolean;
  sortState: DataTableSortState | null;
  onSort: (key: string) => void;
}) {
  if (!sortable) {
    return <>{label}</>;
  }

  const active = sortState?.columnKey === columnKey;
  const Icon = active
    ? sortState.direction === 'asc'
      ? IconChevronUp
      : IconChevronDown
    : IconSelector;

  return (
    <button
      type="button"
      className={classes.sortButton}
      onClick={() => onSort(columnKey)}
      aria-sort={active ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span>{label}</span>
      <Icon
        size={14}
        stroke={1.5}
        className={active ? classes.sortIconActive : classes.sortIcon}
        aria-hidden
      />
    </button>
  );
}

export default function DataTable<T>({
  rows,
  rowKey,
  callsignColumn,
  nameColumn,
  columns,
  emptyState,
  caption,
  toolbar,
  variant = 'list',
  sort: controlledSort,
  onSortChange,
  defaultSort,
  search,
  searchPending,
  onSearchChange,
  searchPlaceholder = 'Filter…',
  showSearch,
  columnVisibility: controlledVisibility,
  onColumnVisibilityChange,
  columnVisibilityStorageKey,
  columnVisibilityLoad,
  selectable: selectableProp,
  selectedKeys: controlledSelectedKeys,
  onSelectedKeysChange,
  filteredEmptyMessage = 'No matches',
  totalRowCount,
  resultCount,
}: DataTableProps<T>) {
  const isList = variant === 'list';
  const showSearchInput = showSearch ?? (isList && onSearchChange !== undefined);
  const selectable = selectableProp ?? false;

  const hideableDefs = useMemo(
    () =>
      columns
        .filter((c) => c.hideable)
        .map((c) => ({
          key: c.key,
          header: c.header,
          defaultVisible: c.defaultVisible,
        })),
    [columns],
  );

  const hasHideableColumns = hideableDefs.length > 0;
  const showColumnPicker =
    isList && hasHideableColumns && (columnVisibilityStorageKey || onColumnVisibilityChange);

  const [storedVisibility, setStoredVisibility] = useDataTableColumnVisibility(
    columnVisibilityStorageKey ?? '__datatable-noop__',
    hideableDefs,
    { enabled: !!columnVisibilityStorageKey, load: columnVisibilityLoad },
  );

  const visibleHideableKeys = useMemo(() => {
    if (controlledVisibility) return controlledVisibility;
    if (columnVisibilityStorageKey) return storedVisibility;
    return hideableDefs.filter((d) => d.defaultVisible !== false).map((d) => d.key);
  }, [controlledVisibility, columnVisibilityStorageKey, storedVisibility, hideableDefs]);

  const setVisibleHideableKeys = useCallback(
    (keys: string[]) => {
      if (onColumnVisibilityChange) {
        onColumnVisibilityChange(keys);
      } else if (columnVisibilityStorageKey) {
        setStoredVisibility(keys);
      }
    },
    [onColumnVisibilityChange, columnVisibilityStorageKey, setStoredVisibility],
  );

  const visibleColumns = useMemo(() => {
    const hideableSet = new Set(hideableDefs.map((d) => d.key));
    return columns.filter(
      (col) => !hideableSet.has(col.key) || visibleHideableKeys.includes(col.key),
    );
  }, [columns, hideableDefs, visibleHideableKeys]);

  const [internalSort, setInternalSort] = useState<DataTableSortState | null>(defaultSort ?? null);
  const sortState = controlledSort !== undefined ? controlledSort : internalSort;

  const handleSort = useCallback(
    (columnKey: string) => {
      const next = nextSortState(sortState, columnKey);
      if (onSortChange) {
        onSortChange(next);
      } else {
        setInternalSort(next);
      }
    },
    [sortState, onSortChange],
  );

  const sortCtx = useMemo(
    () => ({ columns: visibleColumns, callsignColumn, nameColumn }),
    [visibleColumns, callsignColumn, nameColumn],
  );

  const sortedRows = useMemo(
    () => sortDataTableRows(rows, sortState, sortCtx),
    [rows, sortState, sortCtx],
  );

  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const selectedKeys = controlledSelectedKeys ?? internalSelected;
  const setSelectedKeys = onSelectedKeysChange ?? setInternalSelected;

  const rowKeys = useMemo(() => sortedRows.map((row) => rowKey(row)), [sortedRows, rowKey]);
  const allSelected = rowKeys.length > 0 && rowKeys.every((k) => selectedKeys.includes(k));
  const someSelected = rowKeys.some((k) => selectedKeys.includes(k)) && !allSelected;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedKeys(selectedKeys.filter((k) => !rowKeys.includes(k)));
    } else {
      const merged = new Set([...selectedKeys, ...rowKeys]);
      setSelectedKeys([...merged]);
    }
  }, [allSelected, rowKeys, selectedKeys, setSelectedKeys]);

  const toggleRow = useCallback(
    (key: string) => {
      if (selectedKeys.includes(key)) {
        setSelectedKeys(selectedKeys.filter((k) => k !== key));
      } else {
        setSelectedKeys([...selectedKeys, key]);
      }
    },
    [selectedKeys, setSelectedKeys],
  );

  const leadingColCount =
    (selectable ? 1 : 0) + (callsignColumn ? 1 : 0) + 1 + visibleColumns.length;
  const defaultEmpty = <EmptyState message="No items" />;
  const displayCount = resultCount ?? sortedRows.length;

  const isFilteredEmpty =
    sortedRows.length === 0 && totalRowCount !== undefined && totalRowCount > 0;

  const columnPickerData = hideableDefs.map((d) => ({ value: d.key, label: d.header }));

  return (
    <Stack gap="sm">
      {showSearchInput || showColumnPicker || toolbar ? (
        <Group gap="sm" align="flex-end" wrap="wrap">
          {showSearchInput ? (
            <TextInput
              placeholder={searchPlaceholder}
              value={search ?? ''}
              onChange={(e) => onSearchChange?.(e.currentTarget.value)}
              rightSection={searchPending ? <Loader size={16} /> : undefined}
              style={{ flex: '1 1 12rem', minWidth: '10rem' }}
              aria-label="Search table"
            />
          ) : null}
          {showColumnPicker ? (
            <MultiSelect
              placeholder="Columns"
              data={columnPickerData}
              value={visibleHideableKeys}
              onChange={setVisibleHideableKeys}
              clearable
              style={{ flex: '1 1 10rem', minWidth: '8rem' }}
              aria-label="Visible columns"
            />
          ) : null}
          {isList && sortedRows.length > 0 ? (
            <Text size="sm" c="dimmed" style={{ marginLeft: 'auto' }}>
              {displayCount} result{displayCount === 1 ? '' : 's'}
            </Text>
          ) : null}
          {toolbar}
        </Group>
      ) : null}

      <ScrollArea.Autosize
        mah={isList ? '60vh' : '40vh'}
        type="auto"
        offsetScrollbars
        data-testid="datatable-scroll"
      >
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead data-testid="datatable-thead">
            <Table.Tr>
              {selectable ? (
                <Table.Th className={classes.stickyTh} style={{ width: 36 }}>
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    aria-label="Select all rows"
                  />
                </Table.Th>
              ) : null}
              {callsignColumn ? (
                <Table.Th className={classes.stickyTh}>
                  <SortableHeader
                    label={callsignColumn.header ?? 'Callsign'}
                    columnKey={DATATABLE_CALLSIGN_SORT_KEY}
                    sortable={callsignColumn.sortable !== false}
                    sortState={sortState}
                    onSort={handleSort}
                  />
                </Table.Th>
              ) : null}
              <Table.Th className={classes.stickyTh}>
                <SortableHeader
                  label={nameColumn.header ?? 'Name'}
                  columnKey={DATATABLE_NAME_SORT_KEY}
                  sortable={nameColumn.sortable !== false}
                  sortState={sortState}
                  onSort={handleSort}
                />
              </Table.Th>
              {visibleColumns.map((col) => (
                <Table.Th key={col.key} className={classes.stickyTh}>
                  <SortableHeader
                    label={col.header}
                    columnKey={col.key}
                    sortable={col.sortable !== false && !!col.sortValue}
                    sortState={sortState}
                    onSort={handleSort}
                  />
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedRows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={leadingColCount}>
                  {isFilteredEmpty ? (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      {filteredEmptyMessage}
                    </Text>
                  ) : (
                    (emptyState ?? defaultEmpty)
                  )}
                </Table.Td>
              </Table.Tr>
            ) : (
              sortedRows.map((row) => {
                const key = rowKey(row);
                return (
                  <Table.Tr key={key} data-selected={selectedKeys.includes(key) || undefined}>
                    {selectable ? (
                      <Table.Td>
                        <Checkbox
                          checked={selectedKeys.includes(key)}
                          onChange={() => toggleRow(key)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select row ${nameColumn.getName(row)}`}
                        />
                      </Table.Td>
                    ) : null}
                    {callsignColumn ? (
                      <Table.Td>
                        <LinkedCell column={callsignColumn} row={row} />
                      </Table.Td>
                    ) : null}
                    <Table.Td>
                      <LinkedCell column={nameColumn} row={row} />
                    </Table.Td>
                    {visibleColumns.map((col) => (
                      <Table.Td key={col.key}>{col.render(row)}</Table.Td>
                    ))}
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>
      {caption ? (
        typeof caption === 'string' ? (
          <Text size="sm" c="dimmed">
            {caption}
          </Text>
        ) : (
          caption
        )
      ) : null}
    </Stack>
  );
}

export type { DataTableSortState };

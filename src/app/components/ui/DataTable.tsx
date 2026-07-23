import {
  Anchor,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconRestore, IconSelector } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import EmptyState from './EmptyState.tsx';
import { useDataTableColumnVisibility } from '../../hooks/useDataTableColumnVisibility.ts';
import {
  DATATABLE_CALLSIGN_SORT_KEY,
  DATATABLE_NAME_SORT_KEY,
  DATATABLE_STORED_ORDER_SORT_KEY,
  isStoredOrderSort,
  nextSortState,
  sortDataTableRows,
  type DataTableSortState,
} from '../../lib/dataTable/sort.ts';
import { useVirtualDataTableRows } from '../../lib/dataTable/useVirtualDataTableRows.ts';
import type { DataTableVirtualizeMode } from '../../lib/dataTable/virtualization.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';
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
  render?: (row: T) => ReactNode;
}

export type DataTableVariant = 'list' | 'embedded';

/**
 * Agreed / export order as a first-class display sort.
 * When active, rows keep the order of `rows` (asc) or reverse (desc).
 * A subtle restore control appears when the table is sorted by another column.
 */
export interface DataTableStoredOrderConfig {
  /**
   * Column key used in sort state. Prefer the export-order column’s `key`
   * (e.g. `'exportOrder'`) so that header participates; otherwise
   * {@link DATATABLE_STORED_ORDER_SORT_KEY}.
   */
  columnKey?: string;
  /** Label for restore control and elevated header weight. Default `'Export order'`. */
  label?: string;
  /** Restore button label when drifted. Default `'Return to export order'`. */
  restoreLabel?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  rowKey: (row: T) => string;
  callsignColumn?: DataTableLinkedColumn<T>;
  nameColumn: DataTableLinkedColumn<T>;
  columns: DataTableColumn<T>[];
  emptyState?: ReactNode;
  caption?: ReactNode;
  /** Rendered below the table (e.g. bulk actions). */
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
  /** When set, rows are clickable and the name column renders as plain text. */
  onRowActivate?: (row: T) => void;
  /**
   * When true, column headers are not sortable and rows keep the order of `rows`
   * (lock-only pattern). Prefer {@link reorderMode} as the public name for
   * export-order lists; this alias remains for existing callers.
   */
  orderMode?: boolean;
  /**
   * Reorder mode: display stays on agreed/`rows` order; mutate via consumer
   * reorder controls (arrows / drag). Column sorts stay off. Distinct from
   * {@link storedOrder}, which allows temporary natural sorts + restore.
   * Equivalent to {@link orderMode}.
   */
  reorderMode?: boolean;
  /**
   * First-class stored/export-order sort: default to `rows` order, allow other
   * column sorts, show a subtle restore control when drifted. Ignored when
   * `orderMode` / `reorderMode` is true.
   */
  storedOrder?: boolean | DataTableStoredOrderConfig;
  /**
   * `'extreme'` forces windowed virtualisation on (role D). Prefer cheap cells —
   * plain text, no per-row heavy work or rich editors.
   */
  scale?: 'default' | 'extreme';
  /** Window tbody rows when count exceeds threshold. Default `'auto'`. */
  virtualize?: DataTableVirtualizeMode;
  /** Estimated row height for the virtualizer (list ~44px, activate rows ~56px). */
  estimatedRowHeight?: number;
  virtualizeOverscan?: number;
  /** Optional class name(s) for each data row (`Table.Tr`). */
  getRowClassName?: (row: T) => string | undefined;
}

function LinkedCell<T>({
  column,
  row,
  asLink,
}: {
  column: DataTableLinkedColumn<T>;
  row: T;
  asLink: boolean;
}) {
  if (column.render) {
    return <>{column.render(row)}</>;
  }
  const name = column.getName(row);
  if (!asLink) {
    return <Text fw={500}>{name}</Text>;
  }
  return (
    <Anchor component={Link} to={column.getPath(row)} fw={500}>
      {name}
    </Anchor>
  );
}

function SortableHeader({
  label,
  columnKey,
  sortable,
  sortState,
  onSort,
  elevated = false,
}: {
  label: string;
  columnKey: string;
  sortable: boolean;
  sortState: DataTableSortState | null;
  onSort: (key: string) => void;
  /** Slightly higher visual weight (stored/export order). */
  elevated?: boolean;
}) {
  if (!sortable) {
    return elevated ? <span className={classes.sortLabelElevated}>{label}</span> : <>{label}</>;
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
      className={
        elevated ? `${classes.sortButton} ${classes.sortButtonElevated}` : classes.sortButton
      }
      onClick={() => onSort(columnKey)}
      aria-sort={active ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className={elevated ? classes.sortLabelElevated : undefined}>{label}</span>
      <Icon
        size={14}
        stroke={1.5}
        className={active ? classes.sortIconActive : classes.sortIcon}
        aria-hidden
      />
    </button>
  );
}

function resolveStoredOrderConfig(
  storedOrder: boolean | DataTableStoredOrderConfig | undefined,
): DataTableStoredOrderConfig | null {
  if (!storedOrder) return null;
  if (storedOrder === true) return {};
  return storedOrder;
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
  onRowActivate,
  orderMode = false,
  reorderMode = false,
  storedOrder,
  scale = 'default',
  virtualize = 'auto',
  estimatedRowHeight,
  virtualizeOverscan,
  getRowClassName,
}: DataTableProps<T>) {
  const isList = variant === 'list';
  const showSearchInput = showSearch ?? (isList && onSearchChange !== undefined);
  const selectable = selectableProp ?? false;
  const effectiveVirtualize: DataTableVirtualizeMode = scale === 'extreme' ? true : virtualize;
  const orderLocked = orderMode || reorderMode;
  const sortingEnabled = !orderLocked;

  const storedOrderConfig = useMemo(
    () => (orderLocked ? null : resolveStoredOrderConfig(storedOrder)),
    [orderLocked, storedOrder],
  );
  const storedOrderColumnKey = storedOrderConfig
    ? (storedOrderConfig.columnKey ?? DATATABLE_STORED_ORDER_SORT_KEY)
    : undefined;
  const storedOrderLabel = storedOrderConfig?.label ?? 'Export order';
  const storedOrderRestoreLabel = storedOrderConfig?.restoreLabel ?? 'Return to export order';
  const storedOrderDefault: DataTableSortState | undefined = storedOrderColumnKey
    ? { columnKey: storedOrderColumnKey, direction: 'asc' }
    : undefined;
  const effectiveDefaultSort = defaultSort ?? storedOrderDefault;

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

  const [internalSort, setInternalSort] = useState<DataTableSortState | null>(
    effectiveDefaultSort ?? null,
  );
  const sortState = controlledSort !== undefined ? controlledSort : internalSort;

  const applySort = useCallback(
    (next: DataTableSortState | null) => {
      if (onSortChange) {
        onSortChange(next);
      } else {
        setInternalSort(next);
      }
    },
    [onSortChange],
  );

  const handleSort = useCallback(
    (columnKey: string) => {
      if (!sortingEnabled) return;
      applySort(nextSortState(sortState, columnKey));
    },
    [sortingEnabled, sortState, applySort],
  );

  const restoreStoredOrder = useCallback(() => {
    if (!storedOrderColumnKey) return;
    applySort({ columnKey: storedOrderColumnKey, direction: 'asc' });
  }, [applySort, storedOrderColumnKey]);

  const sortCtx = useMemo(
    () => ({
      columns: visibleColumns,
      callsignColumn,
      nameColumn,
      storedOrderColumnKey,
    }),
    [visibleColumns, callsignColumn, nameColumn, storedOrderColumnKey],
  );

  const sortedRows = useMemo(
    () => (orderLocked ? rows : sortDataTableRows(rows, sortState, sortCtx)),
    [orderLocked, rows, sortState, sortCtx],
  );

  const showRestoreStoredOrder =
    sortingEnabled && !!storedOrderColumnKey && !isStoredOrderSort(sortState, storedOrderColumnKey);

  const hasStoredOrderColumn =
    !!storedOrderColumnKey && visibleColumns.some((col) => col.key === storedOrderColumnKey);
  /** Leading header when stored order has no matching data column. */
  const showLeadingStoredOrderSort =
    sortingEnabled && !!storedOrderColumnKey && !hasStoredOrderColumn;

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
    (selectable ? 1 : 0) +
    (showLeadingStoredOrderSort ? 1 : 0) +
    (callsignColumn ? 1 : 0) +
    1 +
    visibleColumns.length;
  const defaultEmpty = <EmptyState message="No items" />;
  const displayCount = resultCount ?? sortedRows.length;

  const isFilteredEmpty =
    sortedRows.length === 0 && totalRowCount !== undefined && totalRowCount > 0;

  const columnPickerData = hideableDefs.map((d) => ({ value: d.key, label: d.header }));
  const [columnModalOpen, setColumnModalOpen] = useState(false);

  const showMetaRow =
    showSearchInput ||
    showColumnPicker ||
    showRestoreStoredOrder ||
    (isList && (totalRowCount !== undefined || resultCount !== undefined));

  const toggleHideableColumn = useCallback(
    (key: string, checked: boolean) => {
      if (checked) {
        setVisibleHideableKeys([...visibleHideableKeys, key]);
      } else {
        setVisibleHideableKeys(visibleHideableKeys.filter((k) => k !== key));
      }
    },
    [setVisibleHideableKeys, visibleHideableKeys],
  );

  const { scrollRef, virtualized, virtualRows, paddingTop, paddingBottom } =
    useVirtualDataTableRows({
      rowCount: sortedRows.length,
      virtualize: effectiveVirtualize,
      estimatedRowHeight,
      virtualizeOverscan,
      hasRowActivate: onRowActivate !== undefined,
    });

  const renderDataRow = useCallback(
    (row: T, reactKey: string) => {
      const key = rowKey(row);
      return (
        <Table.Tr
          key={reactKey}
          data-testid="datatable-tbody-row"
          data-selected={selectedKeys.includes(key) || undefined}
          className={getRowClassName?.(row)}
          onClick={onRowActivate ? () => onRowActivate(row) : undefined}
          style={onRowActivate ? { cursor: 'pointer' } : undefined}
        >
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
          {showLeadingStoredOrderSort ? <Table.Td /> : null}
          {callsignColumn ? (
            <Table.Td>
              <LinkedCell column={callsignColumn} row={row} asLink={!onRowActivate} />
            </Table.Td>
          ) : null}
          <Table.Td>
            <LinkedCell column={nameColumn} row={row} asLink={!onRowActivate} />
          </Table.Td>
          {visibleColumns.map((col) => (
            <Table.Td key={col.key}>{col.render(row)}</Table.Td>
          ))}
        </Table.Tr>
      );
    },
    [
      rowKey,
      selectedKeys,
      onRowActivate,
      selectable,
      toggleRow,
      showLeadingStoredOrderSort,
      nameColumn,
      callsignColumn,
      visibleColumns,
      getRowClassName,
    ],
  );

  const renderVirtualSpacer = (height: number, position: 'top' | 'bottom') => {
    if (height <= 0) return null;
    return (
      <Table.Tr aria-hidden data-testid={`datatable-virtual-spacer-${position}`}>
        <Table.Td
          colSpan={leadingColCount}
          style={{ height, padding: 0, border: 'none', lineHeight: 0 }}
        />
      </Table.Tr>
    );
  };

  return (
    <Stack gap="sm">
      {showSearchInput ? (
        <TextInput
          placeholder={searchPlaceholder}
          value={search ?? ''}
          onChange={(e) => onSearchChange?.(e.currentTarget.value)}
          rightSection={searchPending ? <Loader size={16} /> : undefined}
          w="100%"
          aria-label="Search table"
        />
      ) : null}

      {showMetaRow ? (
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <Group gap="sm" align="center" wrap="wrap">
            {isList || totalRowCount !== undefined || resultCount !== undefined ? (
              <Text size="sm" c="dimmed">
                {displayCount} result{displayCount === 1 ? '' : 's'}
              </Text>
            ) : null}
            {showRestoreStoredOrder ? (
              <Button
                type="button"
                variant="light"
                color="gray"
                size="compact-sm"
                leftSection={<IconRestore size={14} stroke={ICON_STROKE} />}
                onClick={restoreStoredOrder}
                aria-label={storedOrderRestoreLabel}
              >
                {storedOrderRestoreLabel}
              </Button>
            ) : null}
          </Group>
          {showColumnPicker ? (
            <Button
              variant="subtle"
              size="compact-sm"
              onClick={() => setColumnModalOpen(true)}
              style={{ flexShrink: 0 }}
            >
              Show/hide cols
            </Button>
          ) : null}
        </Group>
      ) : null}

      <ScrollArea.Autosize
        mah={isList ? '60vh' : '40vh'}
        type="auto"
        offsetScrollbars
        overscrollBehavior="contain"
        viewportRef={scrollRef}
        data-testid="datatable-scroll"
        data-virtualized={virtualized || undefined}
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
              {showLeadingStoredOrderSort && storedOrderColumnKey ? (
                <Table.Th className={classes.stickyTh}>
                  <SortableHeader
                    label={storedOrderLabel}
                    columnKey={storedOrderColumnKey}
                    sortable
                    sortState={sortState}
                    onSort={handleSort}
                    elevated
                  />
                </Table.Th>
              ) : null}
              {callsignColumn ? (
                <Table.Th className={classes.stickyTh}>
                  <SortableHeader
                    label={callsignColumn.header ?? 'Callsign'}
                    columnKey={DATATABLE_CALLSIGN_SORT_KEY}
                    sortable={sortingEnabled && callsignColumn.sortable !== false}
                    sortState={sortState}
                    onSort={handleSort}
                  />
                </Table.Th>
              ) : null}
              <Table.Th className={classes.stickyTh}>
                <SortableHeader
                  label={nameColumn.header ?? 'Name'}
                  columnKey={DATATABLE_NAME_SORT_KEY}
                  sortable={sortingEnabled && nameColumn.sortable !== false}
                  sortState={sortState}
                  onSort={handleSort}
                />
              </Table.Th>
              {visibleColumns.map((col) => {
                const isStoredOrderCol = !!storedOrderColumnKey && col.key === storedOrderColumnKey;
                const columnSortable =
                  sortingEnabled &&
                  (isStoredOrderCol || (col.sortable !== false && !!col.sortValue));
                return (
                  <Table.Th key={col.key} className={classes.stickyTh}>
                    <SortableHeader
                      label={col.header}
                      columnKey={col.key}
                      sortable={columnSortable}
                      sortState={sortState}
                      onSort={handleSort}
                      elevated={isStoredOrderCol}
                    />
                  </Table.Th>
                );
              })}
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
            ) : virtualized ? (
              <>
                {renderVirtualSpacer(paddingTop, 'top')}
                {virtualRows.map((virtualRow) => {
                  const row = sortedRows[virtualRow.index]!;
                  return renderDataRow(row, rowKey(row));
                })}
                {renderVirtualSpacer(paddingBottom, 'bottom')}
              </>
            ) : (
              sortedRows.map((row) => renderDataRow(row, rowKey(row)))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea.Autosize>

      {toolbar ? <Group gap="sm">{toolbar}</Group> : null}

      {caption ? (
        typeof caption === 'string' ? (
          <Text size="sm" c="dimmed">
            {caption}
          </Text>
        ) : (
          caption
        )
      ) : null}

      {showColumnPicker ? (
        <Modal
          opened={columnModalOpen}
          onClose={() => setColumnModalOpen(false)}
          title="Show/hide columns"
          size="sm"
        >
          <Stack gap="xs">
            {columnPickerData.map((col) => (
              <Checkbox
                key={col.value}
                label={col.label}
                checked={visibleHideableKeys.includes(col.value)}
                onChange={(e) => toggleHideableColumn(col.value, e.currentTarget.checked)}
              />
            ))}
          </Stack>
        </Modal>
      ) : null}
    </Stack>
  );
}

export type { DataTableSortState };

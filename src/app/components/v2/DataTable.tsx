import { Loader, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconArrowDown,
  IconArrowUp,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconSelector,
} from '@tabler/icons-react';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { reorderSelectedKeys } from '@core/domain/zoneOrder.ts';
import {
  DataTableBulkReorderProvider,
  DataTableBulkReorderSortable,
} from '../../lib/dataTable/DataTableBulkReorder.tsx';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import SelectedItemDragHandle, {
  type SelectedItemDragHandleProps,
} from '../ui/SelectedItemDragHandle.tsx';
import Button from './Button.tsx';
import Checkbox from './Checkbox.tsx';
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
  /** Shown in the column-visibility popover; hidden columns still exist unless toggled off. */
  hideable?: boolean;
  /** Whether a hideable column starts visible. Default `true`. */
  defaultVisible?: boolean;
  /** Dropped on narrow viewports unless re-enabled via the column-visibility popover. */
  hideOnMobile?: boolean;
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
  /** Adds a checkbox column and selection toolbar. */
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  /** Rows failing this predicate render a disabled, dimmed checkbox and are excluded from "select all". */
  isRowSelectable?: (row: T) => boolean;
  /** Slot for bulk-action buttons, shown in the selection toolbar alongside a Clear action. */
  bulkActions?: ReactNode;
  onClearSelection?: () => void;
  /**
   * Locks display to `rows` order (column sort disabled) and adds a leading
   * Order column with a per-row drag handle.
   */
  reorderMode?: boolean;
  onReorder?: (nextRows: T[]) => void;
  /** Adds Move up/down to the selection toolbar. Requires `selectable` + `reorderMode`. */
  bulkReorder?: boolean;
  /** Expand/collapse lead column, recursing into `getChildren(row)` for expanded parents. */
  nested?: boolean;
  getChildren?: (row: T) => T[] | undefined;
  /** `'extreme'` adds a sticky header and a max-height scroll region for dense tables. */
  scale?: 'default' | 'extreme';
  /** Controlled column visibility for `hideable` columns; uncontrolled (per-column `defaultVisible`) if omitted. */
  visibleKeys?: string[];
  onVisibleKeysChange?: (keys: string[]) => void;
  /** Makes rows clickable; disabled for rows failing `isRowSelectable` when `selectable` is set. */
  onRowActivate?: (row: T) => void;
  /** `'nestParent'` gives the row a quiet background. */
  getRowVariant?: (row: T) => 'nestParent' | undefined;
  className?: string;
}

interface FlatRow<T> {
  row: T;
  key: string;
  depth: number;
  hasChildren: boolean;
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

interface DataTableBodyRowProps<T> {
  flat: FlatRow<T>;
  columns: DataTableColumn<T>[];
  visibleColumns: DataTableColumn<T>[];
  gridTemplateColumns: string;
  nested: boolean;
  selectable: boolean;
  selected: boolean;
  rowSelectable: boolean;
  onToggleRow: (key: string) => void;
  reorderMode: boolean;
  reorderDragEnabled: boolean;
  topLevelIndex: number;
  isExpanded: boolean;
  onToggleExpanded: (key: string) => void;
  rowVariant: 'nestParent' | undefined;
  activatable: boolean;
  onActivate: () => void;
}

/** One data row. Always calls `useSortable` (inert when `reorderDragEnabled` is false or there's no ancestor `DndContext`) so hook order stays stable regardless of mode. */
function DataTableBodyRow<T>({
  flat,
  visibleColumns,
  gridTemplateColumns,
  nested,
  selectable,
  selected,
  rowSelectable,
  onToggleRow,
  reorderMode,
  reorderDragEnabled,
  topLevelIndex,
  isExpanded,
  onToggleExpanded,
  rowVariant,
  activatable,
  onActivate,
}: DataTableBodyRowProps<T>) {
  const { row, key, depth, hasChildren } = flat;
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: key, disabled: !reorderDragEnabled });

  const style: CSSProperties = {
    gridTemplateColumns,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.65 : undefined,
    position: 'relative',
    zIndex: isDragging ? 1 : undefined,
  };

  const dragHandle: SelectedItemDragHandleProps | null = reorderDragEnabled
    ? { setActivatorNodeRef, attributes, listeners, disabled: false }
    : null;

  return (
    <div
      ref={setNodeRef}
      role="row"
      className={[
        classes.dataRow,
        selectable && !rowSelectable ? classes.rowGated : '',
        rowVariant === 'nestParent' ? classes.rowNestParent : '',
        activatable ? classes.rowActivatable : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      onClick={activatable ? onActivate : undefined}
    >
      {nested ? (
        <div role="cell" className={classes.leadCell} style={{ paddingLeft: 6 + depth * 16 }}>
          {hasChildren ? (
            <button
              type="button"
              className={classes.expandButton}
              aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpanded(key);
              }}
            >
              <IconChevronRight
                size={ICON_SIZE_NAV}
                stroke={ICON_STROKE}
                className={isExpanded ? classes.expandIconOpen : undefined}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
      ) : null}
      {selectable ? (
        <div role="cell" className={classes.leadCell}>
          {rowSelectable ? (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggleRow(key)}
              onClick={(event) => event.stopPropagation()}
              aria-label={`Select row ${key}`}
            />
          ) : null}
        </div>
      ) : null}
      {reorderMode ? (
        <div role="cell" className={classes.orderCell}>
          {depth === 0 ? (
            <>
              <span className={classes.orderIndex}>{topLevelIndex + 1}</span>
              <span onClick={(event) => event.stopPropagation()}>
                <SelectedItemDragHandle dragHandle={dragHandle} />
              </span>
            </>
          ) : null}
        </div>
      ) : null}
      {visibleColumns.map((col) => (
        <div
          role="cell"
          key={col.key}
          className={[
            classes.dataCell,
            col.key === 'actions' ? classes.actionCell : '',
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
  selectable = false,
  selectedKeys: controlledSelectedKeys,
  onSelectionChange,
  isRowSelectable,
  bulkActions,
  onClearSelection,
  reorderMode = false,
  onReorder,
  bulkReorder = false,
  nested = false,
  getChildren,
  scale = 'default',
  visibleKeys: controlledVisibleKeys,
  onVisibleKeysChange,
  onRowActivate,
  getRowVariant,
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
    if (reorderMode) return;
    applySort(nextSortDirection(sortState, key));
  };

  const sortColumn = sortState ? columns.find((col) => col.key === sortState.key) : undefined;

  const sortedRows = useMemo(() => {
    if (reorderMode || !sortState || !sortColumn?.sortValue) return rows;
    const { sortValue } = sortColumn;
    const direction = sortState.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => direction * compareValues(sortValue(a), sortValue(b)));
  }, [reorderMode, rows, sortState, sortColumn]);

  const rowsByKey = useMemo(
    () => new Map(rows.map((row) => [getRowId(row), row])),
    [rows, getRowId],
  );

  const setOrder = (nextKeys: string[]) => {
    if (!onReorder) return;
    onReorder(nextKeys.map((key) => rowsByKey.get(key)!));
  };

  const moveSelected = (keysToMove: string[], direction: 'up' | 'down') => {
    setOrder(
      reorderSelectedKeys(
        rows.map((row) => getRowId(row)),
        new Set(keysToMove),
        direction,
      ),
    );
  };

  const displayCount = resultCount ?? sortedRows.length;
  const isFilteredEmpty =
    sortedRows.length === 0 && totalRowCount !== undefined && totalRowCount > 0;
  const showMetaRow = !!search || totalRowCount !== undefined || resultCount !== undefined;

  const isMobileViewport = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  const hideableDefs = columns.filter((col) => col.hideable);
  const [internalVisibleKeys, setInternalVisibleKeys] = useState<string[]>(() =>
    hideableDefs.filter((col) => col.defaultVisible !== false).map((col) => col.key),
  );
  const visibleHideableKeys = controlledVisibleKeys ?? internalVisibleKeys;
  const setVisibleHideableKeys = onVisibleKeysChange ?? setInternalVisibleKeys;
  const showColumnPicker = hideableDefs.length > 0;
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);

  const toggleColumnVisible = (key: string, checked: boolean) => {
    setVisibleHideableKeys(
      checked ? [...visibleHideableKeys, key] : visibleHideableKeys.filter((k) => k !== key),
    );
  };

  const visibleColumns = columns.filter((col) => {
    if (col.hideable && !visibleHideableKeys.includes(col.key)) return false;
    if (isMobileViewport && col.hideOnMobile) {
      return col.hideable && visibleHideableKeys.includes(col.key);
    }
    return true;
  });

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const flattenedRows = useMemo(() => {
    if (!nested || !getChildren) {
      return sortedRows.map((row): FlatRow<T> => {
        const children = getChildren?.(row);
        return { row, key: getRowId(row), depth: 0, hasChildren: !!children?.length };
      });
    }
    const flat: FlatRow<T>[] = [];
    const visit = (row: T, depth: number) => {
      const key = getRowId(row);
      const children = getChildren(row);
      flat.push({ row, key, depth, hasChildren: !!children?.length });
      if (children?.length && expandedKeys.has(key)) {
        children.forEach((child) => visit(child, depth + 1));
      }
    };
    sortedRows.forEach((row) => visit(row, 0));
    return flat;
  }, [nested, getChildren, sortedRows, getRowId, expandedKeys]);

  const [internalSelectedKeys, setInternalSelectedKeys] = useState<string[]>([]);
  const selectedKeys = controlledSelectedKeys ?? internalSelectedKeys;
  const setSelectedKeys = onSelectionChange ?? setInternalSelectedKeys;

  const rowIsSelectable = (row: T) => isRowSelectable?.(row) ?? true;
  const selectableRowKeys = flattenedRows
    .filter((flat) => rowIsSelectable(flat.row))
    .map((flat) => flat.key);
  const allSelected =
    selectable &&
    selectableRowKeys.length > 0 &&
    selectableRowKeys.every((k) => selectedKeys.includes(k));
  const someSelected =
    selectable && selectableRowKeys.some((k) => selectedKeys.includes(k)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedKeys(selectedKeys.filter((k) => !selectableRowKeys.includes(k)));
    } else {
      setSelectedKeys([...new Set([...selectedKeys, ...selectableRowKeys])]);
    }
  };

  const toggleRow = (key: string) => {
    setSelectedKeys(
      selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key],
    );
  };

  const showSelectionToolbar = selectable && selectedKeys.length > 0;

  const reorderableRowKeys = reorderMode
    ? flattenedRows.filter((f) => f.depth === 0 && !f.hasChildren).map((f) => f.key)
    : [];
  const dragSortableKeys = onReorder ? reorderableRowKeys : [];

  const gridTemplateColumns = [
    nested ? '36px' : null,
    selectable ? '40px' : null,
    reorderMode ? '68px' : null,
    ...visibleColumns.map((col) => col.width ?? '1fr'),
  ]
    .filter(Boolean)
    .join(' ');

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

      {showMetaRow || showColumnPicker ? (
        <div className={classes.metaRow}>
          <span className={classes.count}>
            {showMetaRow ? countLabel(displayCount, totalRowCount) : null}
          </span>
          {showColumnPicker ? (
            <div className={classes.columnPickerWrapper}>
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={columnPickerOpen}
                onClick={() => setColumnPickerOpen((open) => !open)}
              >
                Show/hide cols
              </Button>
              {columnPickerOpen ? (
                <div className={classes.columnPicker} role="menu">
                  {hideableDefs.map((col) => (
                    <label key={col.key} className={classes.columnPickerRow}>
                      <Checkbox
                        checked={visibleHideableKeys.includes(col.key)}
                        onCheckedChange={(checked) => toggleColumnVisible(col.key, checked)}
                      />
                      <span>{col.header}</span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {showSelectionToolbar ? (
        <div className={classes.selectionToolbar}>
          <span className={classes.selectionCount}>{selectedKeys.length} selected</span>
          {bulkReorder && reorderMode ? (
            <span className={classes.bulkReorderButtons}>
              <button
                type="button"
                className={classes.moveButton}
                aria-label="Move selected up"
                onClick={() => moveSelected(selectedKeys, 'up')}
              >
                <IconArrowUp size={14} stroke={ICON_STROKE} aria-hidden />
              </button>
              <button
                type="button"
                className={classes.moveButton}
                aria-label="Move selected down"
                onClick={() => moveSelected(selectedKeys, 'down')}
              >
                <IconArrowDown size={14} stroke={ICON_STROKE} aria-hidden />
              </button>
            </span>
          ) : null}
          {bulkActions}
          <button type="button" className={classes.clearSelection} onClick={onClearSelection}>
            Clear
          </button>
        </div>
      ) : null}

      <div className={classes.table} role="table" data-scale={scale}>
        <div className={classes.headerRow} role="row" style={{ gridTemplateColumns }}>
          {nested ? <div role="columnheader" className={classes.leadCell} /> : null}
          {selectable ? (
            <div role="columnheader" className={classes.leadCell}>
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onCheckedChange={toggleAll}
                aria-label="Select all rows"
              />
            </div>
          ) : null}
          {reorderMode ? (
            <div role="columnheader" className={classes.headerCell}>
              Order
            </div>
          ) : null}
          {visibleColumns.map((col) => {
            const active = sortState?.key === col.key;
            const Icon = active
              ? sortState!.direction === 'asc'
                ? IconChevronUp
                : IconChevronDown
              : IconSelector;
            const sortable = !reorderMode && col.sortable !== false && !!col.sortValue;

            return (
              <div
                key={col.key}
                role="columnheader"
                aria-sort={
                  active ? (sortState!.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                }
                className={[
                  classes.headerCell,
                  col.key === 'actions' ? classes.actionCell : '',
                  col.align === 'right' ? classes.alignRight : '',
                ]
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
          {flattenedRows.length === 0 ? (
            <div className={classes.emptyRow} role="row">
              <div role="cell" className={classes.emptyCell}>
                {isFilteredEmpty ? filteredEmptyMessage : emptyMessage}
              </div>
            </div>
          ) : (
            <DataTableBulkReorderProvider
              sortableKeys={dragSortableKeys}
              orderedKeys={rows.map((row) => getRowId(row))}
              selectedKeys={selectedKeys}
              onSetOrder={setOrder}
            >
              <DataTableBulkReorderSortable sortableKeys={dragSortableKeys}>
                {flattenedRows.map((flat) => {
                  const rowSelectable = rowIsSelectable(flat.row);
                  const topLevelIndex =
                    flat.depth === 0 ? rows.findIndex((r) => getRowId(r) === flat.key) : -1;
                  const rowVariant = getRowVariant?.(flat.row);
                  const activatable = !!onRowActivate && (!selectable || rowSelectable);

                  return (
                    <DataTableBodyRow
                      key={flat.key}
                      flat={flat}
                      columns={columns}
                      visibleColumns={visibleColumns}
                      gridTemplateColumns={gridTemplateColumns}
                      nested={nested}
                      selectable={selectable}
                      selected={selectedKeys.includes(flat.key)}
                      rowSelectable={rowSelectable}
                      onToggleRow={toggleRow}
                      reorderMode={reorderMode}
                      reorderDragEnabled={dragSortableKeys.includes(flat.key)}
                      topLevelIndex={topLevelIndex}
                      isExpanded={expandedKeys.has(flat.key)}
                      onToggleExpanded={toggleExpanded}
                      rowVariant={rowVariant}
                      activatable={activatable}
                      onActivate={() => onRowActivate?.(flat.row)}
                    />
                  );
                })}
              </DataTableBulkReorderSortable>
            </DataTableBulkReorderProvider>
          )}
        </div>
      </div>

      {caption ? <div className={classes.caption}>{caption}</div> : null}
    </div>
  );
}

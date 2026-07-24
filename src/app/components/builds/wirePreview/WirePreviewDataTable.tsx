import { useCallback, useMemo, useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { ActionIcon, Badge, Group, Stack, Switch, Text } from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { isEntityExcluded } from '@core/domain/formatBuildOverrides.ts';
import type { BuildEntityOverride } from '@core/models/formatBuild.ts';
import type { WirePreviewEntityKind, WirePreviewRow } from '@core/services/previewWireRows.ts';
import type { ZoneGroupingLayout } from '@core/models/traitLayout.ts';
import { layoutEntry } from '@core/import-export/zoneDerivedScanLists/members.ts';
import { LIST_NAME_FILTER_DEBOUNCE_MS } from '@integrations/listPrefs/index.ts';
import DataTable, {
  type DataTableSortState,
  useDataTableBulkReorderDragHandle,
} from '../../ui/DataTable.tsx';
import SelectedItemDragHandle from '../../ui/SelectedItemDragHandle.tsx';
import dataTableClasses from '../../ui/DataTable.module.css';
import WirePreviewListNameCell from './WirePreviewListNameCell.tsx';
import WirePreviewDisplayCell from './WirePreviewDisplayCell.tsx';
import WirePreviewInclusionCell from './WirePreviewInclusionCell.tsx';
import { rowEffectivelyIncluded } from './wirePreviewRowUtils.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';
import {
  applyWirePreviewNestCollapse,
  filterNestedWirePreviewRows,
  groupWirePreviewChannelRows,
  type WirePreviewTableRow,
} from './groupWirePreviewChannelRows.ts';

export interface WirePreviewReorderConfig {
  orderedKeys: string[];
  onMove: (rowKey: string, direction: 'up' | 'down') => void;
  onSetOrder: (orderedKeys: string[]) => void;
  disabled?: boolean;
  /** Enable multi-select + drag toolbar (default false). */
  bulkReorder?: boolean;
}

function WirePreviewReorderCell({
  row,
  reorder,
  reorderIndexByKey,
}: {
  row: WirePreviewTableRow;
  reorder: WirePreviewReorderConfig;
  reorderIndexByKey: Map<string, number>;
}) {
  const dragHandle = useDataTableBulkReorderDragHandle();
  const index = reorderIndexByKey.get(row.key) ?? -1;
  return (
    <Group gap={4} onClick={(e) => e.stopPropagation()}>
      {reorder.bulkReorder ? <SelectedItemDragHandle dragHandle={dragHandle} /> : null}
      <ActionIcon
        variant="subtle"
        size="sm"
        aria-label="Move up"
        disabled={reorder.disabled || index <= 0}
        onClick={() => reorder.onMove(row.key, 'up')}
      >
        <IconArrowUp size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
      </ActionIcon>
      <ActionIcon
        variant="subtle"
        size="sm"
        aria-label="Move down"
        disabled={reorder.disabled || index < 0 || index >= reorder.orderedKeys.length - 1}
        onClick={() => reorder.onMove(row.key, 'down')}
      >
        <IconArrowDown size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
      </ActionIcon>
    </Group>
  );
}

/** DM32 / Anytone zones table — inline export-as-scan-list toggle per zone row. */
export interface WirePreviewZoneScanColumnConfig {
  layout: ZoneGroupingLayout;
  saving: boolean;
  onExportScanListChange: (zoneId: string, enabled: boolean) => void;
}

/** Inline Skip / Force export on the wire list (dense include controls). */
export interface WirePreviewInclusionColumnConfig {
  saving?: boolean;
  onExcludedChange: (row: WirePreviewRow, excluded: boolean) => void;
  onForceIncludeChange?: (row: WirePreviewRow, forceInclude: boolean) => void;
}

export interface WirePreviewDataTableProps {
  rows: WirePreviewRow[];
  onRowActivate: (row: WirePreviewRow) => void;
  entityKind?: WirePreviewEntityKind;
  search?: string;
  onSearchChange?: (value: string) => void;
  sort?: DataTableSortState | null;
  onSortChange?: (state: DataTableSortState | null) => void;
  reorder?: WirePreviewReorderConfig;
  locationByKey?: Map<string, number>;
  zoneScanColumn?: WirePreviewZoneScanColumnConfig;
  inclusionColumn?: WirePreviewInclusionColumnConfig;
  emptyMessage?: string;
  /**
   * Channel overrides for parent-id skip when nesting Channels projections (#560).
   * When omitted, nest chrome still groups but parent Skip state defaults to false.
   */
  channelOverrides?: readonly BuildEntityOverride[];
  selectedKeys?: string[];
  onSelectedKeysChange?: (keys: string[]) => void;
}

export default function WirePreviewDataTable({
  rows,
  onRowActivate,
  entityKind,
  search = '',
  onSearchChange,
  sort,
  onSortChange,
  reorder,
  locationByKey,
  zoneScanColumn,
  inclusionColumn,
  emptyMessage = 'No library entities of this type yet.',
  channelOverrides,
  selectedKeys,
  onSelectedKeysChange,
}: WirePreviewDataTableProps) {
  const [internalSort, setInternalSort] = useState<DataTableSortState | null>(null);
  const effectiveSort = sort !== undefined ? sort : internalSort;
  const setSort = onSortChange ?? setInternalSort;
  const [debouncedSearch] = useDebouncedValue(search, LIST_NAME_FILTER_DEBOUNCE_MS);
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(() => new Set());

  const nestChannels = entityKind === 'channel';

  const nestedRows = useMemo(() => {
    if (!nestChannels) return rows as WirePreviewTableRow[];
    return groupWirePreviewChannelRows(rows, (parentId) =>
      isEntityExcluded(channelOverrides, parentId),
    );
  }, [nestChannels, rows, channelOverrides]);

  const filteredRows = useMemo(() => {
    const searched = filterNestedWirePreviewRows(nestedRows, debouncedSearch ?? '');
    if (!nestChannels) return searched;
    return applyWirePreviewNestCollapse(searched, collapsedParentIds);
  }, [nestedRows, debouncedSearch, nestChannels, collapsedParentIds]);

  const toggleNest = useCallback((parentId: string) => {
    setCollapsedParentIds((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }, []);

  const handleRowActivate = useCallback(
    (row: WirePreviewTableRow) => {
      if (row.nestRole === 'parent') {
        toggleNest(row.libraryEntityId);
        return;
      }
      onRowActivate(row);
    },
    [onRowActivate, toggleNest],
  );

  const reorderIndexByKey = useMemo(() => {
    if (!reorder) return new Map<string, number>();
    return new Map(reorder.orderedKeys.map((key, index) => [key, index]));
  }, [reorder]);

  return (
    <DataTable
      rows={filteredRows}
      rowKey={(row) => (row.nestRole === 'parent' ? `nest-parent:${row.key}` : row.key)}
      onRowActivate={handleRowActivate}
      reorderMode={Boolean(reorder)}
      getRowClassName={(row) => {
        if (row.nestRole === 'parent') return dataTableClasses.rowNestParent;
        return undefined;
      }}
      nameColumn={{
        header: 'Library name',
        getName: (row) => row.displayLabel,
        getPath: () => '#',
        sortable: true,
        sortValue: (row) => row.displayLabel.toLowerCase(),
        render: (row) => (
          <WirePreviewListNameCell
            row={row}
            nestExpanded={!collapsedParentIds.has(row.libraryEntityId)}
            onToggleNest={
              row.nestRole === 'parent' ? () => toggleNest(row.libraryEntityId) : undefined
            }
          />
        ),
      }}
      columns={[
        ...(inclusionColumn
          ? [
              {
                key: 'inclusion',
                header: 'Skip / Force',
                hideable: false,
                render: (row: WirePreviewTableRow) => (
                  <WirePreviewInclusionCell
                    row={row}
                    disabled={inclusionColumn.saving}
                    onExcludedChange={inclusionColumn.onExcludedChange}
                    onForceIncludeChange={
                      row.nestRole === 'parent' ? undefined : inclusionColumn.onForceIncludeChange
                    }
                  />
                ),
              },
            ]
          : []),
        ...(locationByKey
          ? [
              {
                key: 'location',
                header: 'Location',
                sortable: true,
                sortValue: (row: WirePreviewTableRow) => locationByKey.get(row.key) ?? 0,
                render: (row: WirePreviewTableRow) => (
                  <Text size="sm">
                    {row.nestRole === 'parent' ? '—' : (locationByKey.get(row.key) ?? '—')}
                  </Text>
                ),
              },
            ]
          : []),
        ...(entityKind === 'contact'
          ? [
              {
                key: 'callsign',
                header: 'Callsign',
                sortable: true,
                sortValue: (row: WirePreviewTableRow) => row.libraryCallsign?.toLowerCase() ?? '',
                render: (row: WirePreviewTableRow) => (
                  <Text size="sm">{row.libraryCallsign?.trim() || '—'}</Text>
                ),
              },
            ]
          : []),
        {
          key: 'exportName',
          header: 'Export name',
          sortable: true,
          sortValue: (row) => row.effectiveWireName.toLowerCase(),
          render: (row) =>
            row.nestRole === 'parent' ? (
              <Text size="sm" c="dimmed">
                —
              </Text>
            ) : (
              <Stack gap={2}>
                <Text size="sm" fw={row.hasWireNameOverride ? 600 : 400}>
                  {row.effectiveWireName}
                </Text>
                {row.hasWireNameOverride ? (
                  <Text size="xs" c="dimmed">
                    Default: {row.generatedWireName}
                  </Text>
                ) : null}
              </Stack>
            ),
        },
        ...(zoneScanColumn
          ? [
              {
                key: 'exportScanList',
                header: 'Export scan list',
                sortable: true,
                sortValue: (row: WirePreviewTableRow) => {
                  if (row.entityKind !== 'zone') return '';
                  const entry = layoutEntry(zoneScanColumn.layout, row.libraryEntityId);
                  return entry?.exportScanList ? '1' : '0';
                },
                render: (row: WirePreviewTableRow) => {
                  if (row.entityKind !== 'zone') {
                    return (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    );
                  }
                  const entry = layoutEntry(zoneScanColumn.layout, row.libraryEntityId);
                  return (
                    <Group gap="xs" onClick={(event) => event.stopPropagation()}>
                      <Switch
                        size="xs"
                        aria-label={`Export ${row.displayLabel} as scan list`}
                        checked={entry?.exportScanList ?? false}
                        disabled={zoneScanColumn.saving}
                        onChange={(event) =>
                          zoneScanColumn.onExportScanListChange(
                            row.libraryEntityId,
                            event.currentTarget.checked,
                          )
                        }
                      />
                    </Group>
                  );
                },
              },
            ]
          : []),
        {
          key: 'status',
          header: 'Status',
          render: (row) => {
            if (row.nestRole === 'parent') {
              return (
                <Badge size="xs" variant="light" color={row.excluded ? 'orange' : 'gray'}>
                  {row.excluded ? 'All skipped' : `${row.nestChildCount} projections`}
                </Badge>
              );
            }
            const included = rowEffectivelyIncluded(row);
            return (
              <Group gap="xs">
                {!included ? (
                  <Badge size="xs" variant="light" color="orange">
                    Skipped
                  </Badge>
                ) : (
                  <Badge size="xs" variant="light" color="green">
                    Included
                  </Badge>
                )}
                {row.hasWireNameOverride ? (
                  <Badge size="xs" variant="outline">
                    Name override
                  </Badge>
                ) : null}
                {row.hasMemberOrderOverride ? (
                  <Badge size="xs" variant="light" color="yellow">
                    Custom member order
                  </Badge>
                ) : null}
              </Group>
            );
          },
        },
        ...(reorder
          ? [
              {
                key: 'reorder',
                header: 'Order',
                render: (row: WirePreviewTableRow) => {
                  if (row.nestRole === 'parent' || row.nestRole === 'child') {
                    return (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    );
                  }
                  return (
                    <WirePreviewReorderCell
                      row={row}
                      reorder={reorder}
                      reorderIndexByKey={reorderIndexByKey}
                    />
                  );
                },
              },
            ]
          : []),
        {
          key: 'details',
          header: 'Details',
          hideable: true,
          defaultVisible: false,
          render: (row) =>
            row.nestRole === 'parent' ? (
              <Text size="sm" c="dimmed">
                —
              </Text>
            ) : (
              <WirePreviewDisplayCell row={row} />
            ),
        },
      ]}
      sort={effectiveSort}
      onSortChange={setSort}
      search={search}
      onSearchChange={onSearchChange}
      searchPending={search !== debouncedSearch}
      searchPlaceholder={
        entityKind === 'contact' ? 'Filter name or callsign…' : 'Filter preview rows…'
      }
      totalRowCount={rows.length}
      resultCount={filteredRows.length}
      filteredEmptyMessage="No matching rows"
      emptyState={
        <Text c="dimmed" size="sm">
          {emptyMessage}
        </Text>
      }
      selectedKeys={selectedKeys}
      onSelectedKeysChange={onSelectedKeysChange}
      bulkReorder={
        reorder?.bulkReorder
          ? {
              orderedKeys: reorder.orderedKeys,
              onSetOrder: reorder.onSetOrder,
              disabled: reorder.disabled,
              isRowReorderable: (row) => row.nestRole !== 'parent' && row.nestRole !== 'child',
            }
          : undefined
      }
      caption={
        reorder
          ? 'Click a row to edit export overrides. Order arrows mutate export order; filter disables reorder.'
          : nestChannels
            ? 'Expanded channels nest under a shaded parent. Parent Skip omits all projections; child Skip omits one wire. Click a projection to edit overrides.'
            : 'Click a row to edit export overrides. Sort and filter affect display only — not export order.'
      }
    />
  );
}

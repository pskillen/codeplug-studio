import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Group, Stack, Switch, Text } from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';
import type { ZoneGroupingLayout } from '@core/models/traitLayout.ts';
import { layoutEntry } from '@core/import-export/zoneDerivedScanLists/members.ts';
import DataTable, { type DataTableSortState } from '../../ui/DataTable.tsx';
import WirePreviewListNameCell from './WirePreviewListNameCell.tsx';
import WirePreviewDisplayCell from './WirePreviewDisplayCell.tsx';
import { rowEffectivelyIncluded } from './wirePreviewRowUtils.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../../lib/iconSizes.ts';

export interface WirePreviewReorderConfig {
  orderedKeys: string[];
  onMove: (rowKey: string, direction: 'up' | 'down') => void;
  disabled?: boolean;
}

/** DM32 / Anytone zones table — inline export-as-scan-list toggle per zone row. */
export interface WirePreviewZoneScanColumnConfig {
  layout: ZoneGroupingLayout;
  saving: boolean;
  onExportScanListChange: (zoneId: string, enabled: boolean) => void;
}

export interface WirePreviewDataTableProps {
  rows: WirePreviewRow[];
  onRowActivate: (row: WirePreviewRow) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
  sort?: DataTableSortState | null;
  onSortChange?: (state: DataTableSortState | null) => void;
  reorder?: WirePreviewReorderConfig;
  locationByKey?: Map<string, number>;
  zoneScanColumn?: WirePreviewZoneScanColumnConfig;
  emptyMessage?: string;
}

function rowSearchText(row: WirePreviewRow): string {
  return [
    row.displayLabel,
    row.generatedWireName,
    row.effectiveWireName,
    row.expansionNote ?? '',
    ...(row.displayDetails?.map((d) => `${d.label} ${d.value}`) ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

export default function WirePreviewDataTable({
  rows,
  onRowActivate,
  search,
  onSearchChange,
  sort,
  onSortChange,
  reorder,
  locationByKey,
  zoneScanColumn,
  emptyMessage = 'No library entities of this type yet.',
}: WirePreviewDataTableProps) {
  const [internalSort, setInternalSort] = useState<DataTableSortState | null>(null);
  const effectiveSort = sort !== undefined ? sort : internalSort;
  const setSort = onSortChange ?? setInternalSort;

  const filteredRows = useMemo(() => {
    const q = search?.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => rowSearchText(row).includes(q));
  }, [rows, search]);

  const reorderIndexByKey = useMemo(() => {
    if (!reorder) return new Map<string, number>();
    return new Map(reorder.orderedKeys.map((key, index) => [key, index]));
  }, [reorder]);

  return (
    <DataTable
      rows={filteredRows}
      rowKey={(row) => row.key}
      onRowActivate={onRowActivate}
      nameColumn={{
        header: 'Library name',
        getName: (row) => row.displayLabel,
        getPath: () => '#',
        sortable: true,
        sortValue: (row) => row.displayLabel.toLowerCase(),
        render: (row) => <WirePreviewListNameCell row={row} />,
      }}
      columns={[
        ...(locationByKey
          ? [
              {
                key: 'location',
                header: 'Location',
                sortable: true,
                sortValue: (row: WirePreviewRow) => locationByKey.get(row.key) ?? 0,
                render: (row: WirePreviewRow) => (
                  <Text size="sm">{locationByKey.get(row.key) ?? '—'}</Text>
                ),
              },
            ]
          : []),
        {
          key: 'exportName',
          header: 'Export name',
          sortable: true,
          sortValue: (row) => row.effectiveWireName.toLowerCase(),
          render: (row) => (
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
                sortValue: (row: WirePreviewRow) => {
                  if (row.entityKind !== 'zone') return '';
                  const entry = layoutEntry(zoneScanColumn.layout, row.libraryEntityId);
                  return entry?.exportScanList ? '1' : '0';
                },
                render: (row: WirePreviewRow) => {
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
              </Group>
            );
          },
        },
        ...(reorder
          ? [
              {
                key: 'reorder',
                header: 'Order',
                render: (row: WirePreviewRow) => {
                  const index = reorderIndexByKey.get(row.key) ?? -1;
                  return (
                    <Group gap={4} onClick={(e) => e.stopPropagation()}>
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
                        disabled={
                          reorder.disabled || index < 0 || index >= reorder.orderedKeys.length - 1
                        }
                        onClick={() => reorder.onMove(row.key, 'down')}
                      >
                        <IconArrowDown size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />
                      </ActionIcon>
                    </Group>
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
          render: (row) => <WirePreviewDisplayCell row={row} />,
        },
      ]}
      sort={effectiveSort}
      onSortChange={setSort}
      search={search}
      onSearchChange={onSearchChange}
      searchPlaceholder="Filter preview rows…"
      totalRowCount={rows.length}
      resultCount={filteredRows.length}
      filteredEmptyMessage="No matching rows"
      emptyState={
        <Text c="dimmed" size="sm">
          {emptyMessage}
        </Text>
      }
      caption="Click a row to edit export overrides. Sort and filter affect display only — not export order."
    />
  );
}

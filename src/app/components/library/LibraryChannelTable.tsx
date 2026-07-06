import { Button, Group, Stack, Text } from '@mantine/core';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import type { Channel, Library, Zone } from '@core/models/library.ts';
import { removeChannelsFromZoneMembers, reorderZoneMembers } from '@core/domain/zoneMembership.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import { DataTable } from '../ui/index.ts';
import type { DataTableSortState } from '../ui/DataTable.tsx';
import {
  channelListColumnsKey,
  loadChannelVisibleColumns,
} from '../../hooks/channelListQueryUtils.ts';
import { useChannelListQuery } from '../../hooks/useChannelListQuery.ts';
import { usePersistedChannelColumnSort } from '../../hooks/usePersistedChannelColumnSort.ts';
import {
  useLibraryChannelColumns,
  useLibraryChannelEffectiveSort,
  useLibraryChannelSortCtx,
} from '../../hooks/useLibraryChannelColumns.tsx';
import { sortDataTableRows } from '../../lib/dataTable/sort.ts';
import { useProjects } from '../../state/useProjects.ts';
import { useOperatorPosition } from '../../state/operatorPosition.tsx';
import { persistence } from '../../state/persistence.ts';

export interface LibraryChannelTableProps {
  library: Library;
  rows: Channel[];
  totalRowCount: number;
  preserveMemberOrder: boolean;
  activeZone: Zone | null;
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectedKeysChange?: (keys: string[]) => void;
  toolbar?: ReactNode;
  rowActions?: (channel: Channel) => ReactNode;
  onZoneUpdated?: () => void;
}

export default function LibraryChannelTable({
  library,
  rows,
  totalRowCount,
  preserveMemberOrder,
  activeZone,
  selectable = true,
  selectedKeys: selectedKeysProp,
  onSelectedKeysChange,
  toolbar,
  rowActions,
  onZoneUpdated,
}: LibraryChannelTableProps) {
  const { activeProjectId } = useProjects();
  const { position } = useOperatorPosition();
  const query = useChannelListQuery();
  const optionalColumnDefs = useLibraryChannelColumns(library, position);
  const sortCtx = useLibraryChannelSortCtx(optionalColumnDefs);
  const [columnSortOverride, setColumnSortOverride] = usePersistedChannelColumnSort();
  const [internalSelectedKeys, setInternalSelectedKeys] = useState<string[]>([]);
  const selectedKeys = selectedKeysProp ?? internalSelectedKeys;
  const setSelectedKeys = onSelectedKeysChange ?? setInternalSelectedKeys;

  const effectiveSort = useLibraryChannelEffectiveSort(
    columnSortOverride,
    query.sortMode,
    position,
    preserveMemberOrder,
  );

  const handleSortChange = useCallback(
    (state: DataTableSortState | null) => {
      if (!state) return;
      setColumnSortOverride(state);
      if (state.columnKey === 'distance') {
        query.setSortMode('distance');
        return;
      }
      if (query.sortMode === 'distance') {
        query.setSortMode('name');
      }
    },
    [query, setColumnSortOverride],
  );

  const sortedRows = useMemo(() => {
    if (preserveMemberOrder && !columnSortOverride) return rows;
    if (!effectiveSort) return rows;
    return sortDataTableRows(rows, effectiveSort, sortCtx);
  }, [columnSortOverride, effectiveSort, preserveMemberOrder, rows, sortCtx]);

  const columnStorageKey = activeProjectId ? channelListColumnsKey(activeProjectId) : undefined;
  const loadVisibleColumns = useCallback(
    () => (activeProjectId ? loadChannelVisibleColumns(activeProjectId) : []),
    [activeProjectId],
  );

  const persistZoneMembers = useCallback(
    async (nextMembers: Zone['members']) => {
      if (!activeZone) return;
      const row: Zone = { ...activeZone, members: nextMembers };
      validateZoneMembership(row.id, nextMembers, {
        ...library,
        zones: library.zones.map((zone) => (zone.id === row.id ? row : zone)),
      });
      const result = await persistence.putZone(row, activeZone.revision);
      if (result.ok) onZoneUpdated?.();
    },
    [activeZone, library, onZoneUpdated],
  );

  const handleRemoveSelected = useCallback(() => {
    if (!activeZone || selectedKeys.length === 0) return;
    const next = removeChannelsFromZoneMembers(activeZone.members, selectedKeys);
    setSelectedKeys([]);
    void persistZoneMembers(next);
  }, [activeZone, persistZoneMembers, selectedKeys, setSelectedKeys]);

  const handleMoveSelected = useCallback(
    (direction: 'up' | 'down') => {
      if (!activeZone || selectedKeys.length === 0) return;
      const keys = new Set(selectedKeys.map((id) => `channel:${id}`));
      const next = reorderZoneMembers(activeZone.members, keys, direction);
      void persistZoneMembers(next);
    },
    [activeZone, persistZoneMembers, selectedKeys],
  );

  const zoneToolbar =
    activeZone && preserveMemberOrder ? (
      <Group gap="xs">
        <Button
          variant="light"
          size="compact-sm"
          disabled={selectedKeys.length === 0}
          onClick={handleRemoveSelected}
        >
          Remove from zone
        </Button>
        <Button
          variant="subtle"
          size="compact-sm"
          disabled={selectedKeys.length === 0}
          onClick={() => handleMoveSelected('up')}
        >
          Move up
        </Button>
        <Button
          variant="subtle"
          size="compact-sm"
          disabled={selectedKeys.length === 0}
          onClick={() => handleMoveSelected('down')}
        >
          Move down
        </Button>
      </Group>
    ) : null;

  const columnsWithActions = useMemo(() => {
    if (!rowActions && !activeZone) return optionalColumnDefs;
    return [
      ...optionalColumnDefs,
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (channel: Channel) => (
          <Group gap="xs" justify="flex-end">
            {rowActions?.(channel)}
            {activeZone ? (
              <Button
                variant="subtle"
                size="compact-xs"
                onClick={() => {
                  void persistZoneMembers(
                    removeChannelsFromZoneMembers(activeZone.members, [channel.id]),
                  );
                }}
              >
                Remove
              </Button>
            ) : null}
          </Group>
        ),
      },
    ];
  }, [activeZone, optionalColumnDefs, persistZoneMembers, rowActions]);

  const distanceSortPending = query.sortMode === 'distance' && !position;

  return (
    <Stack gap="sm">
      {distanceSortPending ? (
        <Text size="sm" c="dimmed">
          Distance sort needs your location — sorted by name until set.
        </Text>
      ) : null}
      <DataTable
        variant="list"
        rows={sortedRows}
        totalRowCount={totalRowCount}
        rowKey={(ch) => ch.id}
        sort={effectiveSort ?? undefined}
        onSortChange={handleSortChange}
        columnVisibilityStorageKey={columnStorageKey}
        columnVisibilityLoad={columnStorageKey ? loadVisibleColumns : undefined}
        callsignColumn={sortCtx.callsignColumn}
        nameColumn={sortCtx.nameColumn}
        columns={columnsWithActions}
        search={query.nameFilterInput}
        searchPending={query.nameFilterPending}
        onSearchChange={query.setNameFilter}
        searchPlaceholder="Filter name or callsign…"
        selectable={selectable}
        selectedKeys={selectedKeys}
        onSelectedKeysChange={setSelectedKeys}
        toolbar={
          <Group gap="xs">
            {zoneToolbar}
            {toolbar}
          </Group>
        }
      />
    </Stack>
  );
}

export function useLibraryChannelTableSelection(): [string[], (keys: string[]) => void] {
  return useState<string[]>([]);
}

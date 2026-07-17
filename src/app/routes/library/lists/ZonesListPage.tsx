import { ActionIcon, Badge, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconArrowDown, IconArrowUp } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Zone } from '@core/models/library.ts';
import { formatZoneDirectMemberSummary } from '@core/domain/zoneMembers.ts';
import { applyFilters, DEFAULT_MAP_FILTER_OPTS } from '@core/domain/mapProjection.ts';
import {
  applyDenseZoneOrders,
  reorderZoneIds,
  sortZonesByExportOrder,
} from '@core/domain/zoneOrder.ts';
import CodeplugMap from '../../../components/CodeplugMap/CodeplugMap.tsx';
import UseMyLocationButton from '../../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import EntityListDeleteAction from '../../../components/library/EntityListDeleteAction.tsx';
import { DataTable, ListPage } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { ICON_STROKE } from '../../../lib/iconSizes.ts';
import { useOperatorPosition } from '../../../state/operatorPosition.tsx';
import { persistence } from '../../../state/persistence.ts';
import { useLibrary } from '../../../state/useLibrary.ts';

export default function ZonesListPage() {
  const { library, loading, reload } = useLibrary();
  const navigate = useNavigate();
  const { channels, zones } = library;
  const { position, setPosition, clearPosition } = useOperatorPosition();
  const { nameFilter, nameFilterInput, nameFilterPending, setNameFilter } =
    useListNameQuery('zones');
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const orderedZones = useMemo(() => sortZonesByExportOrder(zones), [zones]);
  const filtered = useMemo(
    () => filterRowsByName(orderedZones, nameFilter, (z) => z.name),
    [orderedZones, nameFilter],
  );
  const filterActive = nameFilter.trim().length > 0;
  const { skipped: mapSkipped } = applyFilters(channels, DEFAULT_MAP_FILTER_OPTS);

  const moveZone = useCallback(
    async (zoneId: string, direction: 'up' | 'down') => {
      if (filterActive || savingOrder) return;
      const orderedIds = orderedZones.map((zone) => zone.id);
      const nextIds = reorderZoneIds(orderedIds, new Set([zoneId]), direction);
      if (nextIds.every((id, index) => id === orderedIds[index])) return;

      const nextZones = applyDenseZoneOrders(zones, nextIds);
      setSavingOrder(true);
      setOrderError(null);
      try {
        for (const zone of nextZones) {
          const prev = zones.find((row) => row.id === zone.id);
          if (!prev || prev.order === zone.order) continue;
          const result = await persistence.putZone(zone, prev.revision);
          if (!result.ok) {
            throw new Error(
              result.reason === 'revision_conflict'
                ? 'Zone was updated elsewhere — reload and try again'
                : 'Failed to save zone order',
            );
          }
        }
        await reload();
      } catch (err) {
        setOrderError(err instanceof Error ? err.message : 'Failed to save zone order');
      } finally {
        setSavingOrder(false);
      }
    },
    [filterActive, orderedZones, reload, savingOrder, zones],
  );

  const columns = useMemo((): DataTableColumn<Zone>[] => {
    return [
      {
        key: 'exportOrder',
        header: 'Export order',
        hideable: false,
        render: (z) => {
          const index = orderedZones.findIndex((row) => row.id === z.id);
          return (
            <Group gap={4} wrap="nowrap">
              <Text size="sm" c="dimmed" w={28}>
                {z.order ?? '—'}
              </Text>
              <Tooltip label="Move up">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label={`Move ${z.name} up`}
                  disabled={filterActive || savingOrder || index <= 0}
                  onClick={(event) => {
                    event.stopPropagation();
                    void moveZone(z.id, 'up');
                  }}
                >
                  <IconArrowUp size={14} stroke={ICON_STROKE} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Move down">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label={`Move ${z.name} down`}
                  disabled={
                    filterActive || savingOrder || index < 0 || index >= orderedZones.length - 1
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    void moveZone(z.id, 'down');
                  }}
                >
                  <IconArrowDown size={14} stroke={ICON_STROKE} />
                </ActionIcon>
              </Tooltip>
            </Group>
          );
        },
      },
      {
        key: 'members',
        header: 'Members',
        render: (z) => {
          const countLabel = formatZoneDirectMemberSummary(z);
          return (
            <Group gap="xs" wrap="nowrap">
              <Text size="sm">{countLabel}</Text>
              {z.omitFromExport ? (
                <Badge size="xs" variant="light">
                  Nested only
                </Badge>
              ) : null}
            </Group>
          );
        },
        sortValue: (z) => z.members.length,
      },
      {
        key: 'comment',
        header: 'Comment',
        render: (z) => z.comment || '—',
        sortValue: (z) => z.comment || '',
      },
      {
        key: 'actions',
        header: '',
        hideable: false,
        render: (z) => <EntityListDeleteAction kind="zone" entityId={z.id} label={z.name} />,
      },
    ];
  }, [filterActive, moveZone, orderedZones, savingOrder]);

  if (loading) {
    return (
      <ListPage title="Zones">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="Zones">
      <Stack gap="lg">
        <Text size="sm" c="dimmed">
          Rows are listed in library export order (`Zone.order`). Use the arrows to reorder — table
          column sort is not used on this page. Clear the name filter to enable reorder.
        </Text>
        {filterActive ? (
          <Text size="sm" c="orange">
            Reorder is disabled while a name filter is active.
          </Text>
        ) : null}
        {orderError ? (
          <Text size="sm" c="red">
            {orderError}
          </Text>
        ) : null}
        <DataTable
          variant="list"
          rows={filtered}
          totalRowCount={zones.length}
          search={nameFilterInput}
          searchPending={nameFilterPending}
          onSearchChange={setNameFilter}
          searchPlaceholder="Filter name…"
          rowKey={(z) => z.id}
          nameColumn={{
            getName: (z) => z.name,
            getPath: (z) => `/library/zones/${z.id}`,
          }}
          columns={columns}
        />

        {position ? (
          <Group gap="sm" align="center">
            {position.accuracyMeters != null && Number.isFinite(position.accuracyMeters) ? (
              <Text size="sm" c="dimmed">
                My location accuracy ±{Math.round(position.accuracyMeters)} m
              </Text>
            ) : null}
            <Button variant="subtle" size="compact-sm" onClick={clearPosition}>
              Clear my location
            </Button>
          </Group>
        ) : (
          <UseMyLocationButton
            label="Show my location"
            onLocation={(lat, lon, accuracyMeters) =>
              setPosition({ lat, lon, accuracyMeters: accuracyMeters ?? null })
            }
          />
        )}

        <CodeplugMap
          channels={channels}
          zones={zones}
          allChannels={channels}
          height={420}
          operatorPosition={position}
          onChannelClick={(id) => navigate(`/library/channels/${id}`)}
          onZoneClick={(id) => navigate(`/library/zones/${id}`)}
        />
        {mapSkipped.length > 0 ? (
          <Text size="sm" c="dimmed">
            {mapSkipped.length} channel{mapSkipped.length === 1 ? '' : 's'} not shown on map
            (missing coordinates, Use Location = No, or 0,0).
          </Text>
        ) : null}
      </Stack>
    </ListPage>
  );
}

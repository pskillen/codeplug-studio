import { Button, Group, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Zone } from '@core/models/library.ts';
import { applyFilters, DEFAULT_MAP_FILTER_OPTS } from '@core/domain/mapProjection.ts';
import CodeplugMap from '../../../components/CodeplugMap/CodeplugMap.tsx';
import UseMyLocationButton from '../../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import { DataTable, ListPage } from '../../../components/ui/index.ts';
import type { DataTableColumn } from '../../../components/ui/DataTable.tsx';
import { filterRowsByName, useListNameQuery } from '../../../hooks/useListNameQuery.ts';
import { usePersistedEntityListSort } from '../../../hooks/usePersistedEntityListSort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../../lib/dataTable/sort.ts';
import { useOperatorPosition } from '../../../state/operatorPosition.tsx';
import { useLibrary } from '../../../state/useLibrary.ts';

export default function ZonesListPage() {
  const { library, loading } = useLibrary();
  const navigate = useNavigate();
  const { channels, zones } = library;
  const { position, setPosition, clearPosition } = useOperatorPosition();
  const { nameFilter, setNameFilter } = useListNameQuery('zones');
  const [sort, setSort] = usePersistedEntityListSort('zones', {
    columnKey: DATATABLE_NAME_SORT_KEY,
    direction: 'asc',
  });
  const filtered = useMemo(
    () => filterRowsByName(zones, nameFilter, (z) => z.name),
    [zones, nameFilter],
  );
  const { skipped: mapSkipped } = applyFilters(channels, DEFAULT_MAP_FILTER_OPTS);

  const columns = useMemo((): DataTableColumn<Zone>[] => {
    return [
      {
        key: 'members',
        header: 'Members',
        render: (z) => z.members.length,
        sortValue: (z) => z.members.length,
      },
      {
        key: 'comment',
        header: 'Comment',
        render: (z) => z.comment || '—',
        sortValue: (z) => z.comment || '',
      },
    ];
  }, []);

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
        <DataTable
          variant="list"
          rows={filtered}
          totalRowCount={zones.length}
          search={nameFilter}
          onSearchChange={setNameFilter}
          searchPlaceholder="Filter name…"
          sort={sort}
          onSortChange={setSort}
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

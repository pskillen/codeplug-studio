import { Button, Group, Stack, Text } from '@mantine/core';
import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Channel } from '@core/models/library.ts';
import { applyFilters, channelHasGeolocation } from '@core/domain/mapProjection.ts';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import { haversineDistanceM } from '@core/domain/geoDistance.ts';
import CodeplugMap from '../../../components/CodeplugMap/CodeplugMap.tsx';
import { BandPillForChannel } from '../../../components/pills/BandPill.tsx';
import ModePill from '../../../components/pills/ModePill.tsx';
import UseMyLocationButton from '../../../components/UseMyLocationButton/UseMyLocationButton.tsx';
import { DataTable, ListPage } from '../../../components/ui/index.ts';
import type { DataTableColumn, DataTableSortState } from '../../../components/ui/DataTable.tsx';
import {
  CHANNEL_OPTIONAL_COLUMNS,
  channelListColumnsKey,
  loadChannelVisibleColumns,
} from '../../../hooks/channelListQueryUtils.ts';
import { useChannelListQuery } from '../../../hooks/useChannelListQuery.ts';
import { usePersistedChannelColumnSort } from '../../../hooks/usePersistedChannelColumnSort.ts';
import {
  DATATABLE_CALLSIGN_SORT_KEY,
  DATATABLE_NAME_SORT_KEY,
} from '../../../lib/dataTable/sort.ts';
import {
  distanceLabelForChannel,
  useFilteredChannels,
} from '../../../hooks/useChannelListFilters.ts';
import { formatChannelRxTxListCell } from '../../../lib/formatFrequency.ts';
import { dmrContactDisplayName, dmrRxGroupListName } from '../../../lib/entityRefs.ts';
import { channelModesForFilter } from '../../../lib/channels.ts';
import { useProjects } from '../../../state/useProjects.ts';
import { useOperatorPosition } from '../../../state/operatorPosition.tsx';
import { useLibrary } from '../../../state/useLibrary.ts';

function percentLabel(value: number | null): string {
  if (value == null) return '—';
  return `${value}%`;
}

export default function ChannelsListPage() {
  const navigate = useNavigate();
  const { library, loading } = useLibrary();
  const { activeProjectId } = useProjects();
  const { channels, zones } = library;
  const { position, setPosition, clearPosition } = useOperatorPosition();
  const query = useChannelListQuery();
  const filtered = useFilteredChannels(channels, query, position, { skipSort: true });
  const [columnSortOverride, setColumnSortOverride] = usePersistedChannelColumnSort();

  const mapChannels = query.distanceFilterEnabled ? filtered : channels;
  const { skipped } = applyFilters(channels, { requireUseLocation: true, skipZero: true });

  const effectiveSort = useMemo((): DataTableSortState => {
    if (columnSortOverride) return columnSortOverride;
    if (query.sortMode === 'distance' && position) {
      return { columnKey: 'distance', direction: 'asc' };
    }
    return { columnKey: DATATABLE_NAME_SORT_KEY, direction: 'asc' };
  }, [columnSortOverride, query.sortMode, position]);

  const handleSortChange = useCallback(
    (state: DataTableSortState | null) => {
      if (!state) return;
      if (
        state.columnKey === DATATABLE_NAME_SORT_KEY ||
        state.columnKey === DATATABLE_CALLSIGN_SORT_KEY
      ) {
        setColumnSortOverride(state);
        if (query.sortMode === 'distance') {
          query.setSortMode('name');
        }
        return;
      }
      if (state.columnKey === 'distance') {
        setColumnSortOverride(state);
        query.setSortMode('distance');
        return;
      }
      setColumnSortOverride(state);
      if (query.sortMode === 'distance') {
        query.setSortMode('name');
      }
    },
    [query, setColumnSortOverride],
  );

  const optionalColumnDefs = useMemo((): DataTableColumn<Channel>[] => {
    return CHANNEL_OPTIONAL_COLUMNS.map((col) => {
      const base = {
        key: col.key,
        header: col.header,
        hideable: true,
        defaultVisible: col.defaultVisible,
      };

      if (col.key === 'abbreviation') {
        return {
          ...base,
          render: (ch: Channel) => ch.abbreviation?.trim() || '—',
          sortValue: (ch: Channel) => ch.abbreviation?.trim() || '',
        };
      }
      if (col.key === 'band') {
        return {
          ...base,
          render: (ch: Channel) => <BandPillForChannel channel={ch} />,
          sortValue: (ch: Channel) => ch.rxFrequency ?? ch.txFrequency ?? 0,
        };
      }
      if (col.key === 'mode') {
        return {
          ...base,
          render: (ch: Channel) => (
            <Group gap={4}>
              {channelModesForFilter(ch).map((mode) => (
                <ModePill key={mode} mode={mode} size="xs" />
              ))}
            </Group>
          ),
          sortValue: (ch: Channel) => channelModesForFilter(ch).join(','),
        };
      }
      if (col.key === 'rxTx') {
        return {
          ...base,
          render: (ch: Channel) => formatChannelRxTxListCell(ch.rxFrequency, ch.txFrequency),
          sortValue: (ch: Channel) => ch.rxFrequency ?? ch.txFrequency,
        };
      }
      if (col.key === 'contact') {
        return {
          ...base,
          render: (ch: Channel) => dmrContactDisplayName(library, ch.id) || '—',
          sortValue: (ch: Channel) => dmrContactDisplayName(library, ch.id),
        };
      }
      if (col.key === 'rgl') {
        return {
          ...base,
          render: (ch: Channel) => dmrRxGroupListName(library, ch.id) || '—',
          sortValue: (ch: Channel) => dmrRxGroupListName(library, ch.id),
        };
      }
      if (col.key === 'distance') {
        return {
          ...base,
          render: (ch: Channel) => (position ? distanceLabelForChannel(ch, position) : '—'),
          sortValue: (ch: Channel) => {
            if (!position || !channelHasGeolocation(ch)) return null;
            return haversineDistanceM(
              position.lat,
              position.lon,
              ch.location!.lat,
              ch.location!.lon,
            );
          },
        };
      }
      if (col.key === 'power') {
        return {
          ...base,
          render: (ch: Channel) => percentLabel(ch.power),
          sortValue: (ch: Channel) => ch.power,
        };
      }
      if (col.key === 'comment') {
        return {
          ...base,
          render: (ch: Channel) => ch.comment || '—',
          sortValue: (ch: Channel) => ch.comment || '',
        };
      }
      return {
        ...base,
        render: (ch: Channel) =>
          ch.location && ch.useLocation
            ? coordsToLocator(ch.location.lat, ch.location.lon, 6)
            : '—',
        sortValue: (ch: Channel) =>
          ch.location && ch.useLocation ? coordsToLocator(ch.location.lat, ch.location.lon, 6) : '',
      };
    });
  }, [library, position]);

  const sortCtx = useMemo(
    () => ({
      columns: optionalColumnDefs,
      callsignColumn: {
        getName: (ch: Channel) => ch.callsign || '—',
        getPath: (ch: Channel) => `/library/channels/${ch.id}`,
        sortValue: (ch: Channel) => ch.callsign || '',
      },
      nameColumn: {
        getName: (ch: Channel) => ch.name || '—',
        getPath: (ch: Channel) => `/library/channels/${ch.id}`,
      },
    }),
    [optionalColumnDefs],
  );

  const distanceSortPending = query.sortMode === 'distance' && !position;

  const columnStorageKey = activeProjectId ? channelListColumnsKey(activeProjectId) : undefined;
  const loadVisibleColumns = useCallback(
    () => (activeProjectId ? loadChannelVisibleColumns(activeProjectId) : []),
    [activeProjectId],
  );

  if (loading) {
    return (
      <ListPage title="Channels">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="Channels">
      <Stack gap="lg">
        {distanceSortPending ? (
          <Text size="sm" c="dimmed">
            Distance sort needs your location. Sorted by name until set — use the Distance column
            header after setting location.
          </Text>
        ) : null}

        <DataTable
          variant="list"
          rows={filtered}
          totalRowCount={channels.length}
          rowKey={(ch) => ch.id}
          sort={effectiveSort}
          onSortChange={handleSortChange}
          columnVisibilityStorageKey={columnStorageKey}
          columnVisibilityLoad={columnStorageKey ? loadVisibleColumns : undefined}
          callsignColumn={sortCtx.callsignColumn}
          nameColumn={sortCtx.nameColumn}
          columns={optionalColumnDefs}
          search={query.nameFilterInput}
          searchPending={query.nameFilterPending}
          onSearchChange={query.setNameFilter}
          searchPlaceholder="Filter name or callsign…"
        />

        {skipped.length > 0 ? (
          <Text size="sm" c="dimmed">
            {skipped.length} channel{skipped.length === 1 ? '' : 's'} not shown on map (missing
            coordinates, Use Location = No, or 0,0).
          </Text>
        ) : null}

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
          channels={mapChannels}
          zones={zones}
          allChannels={channels}
          height={420}
          operatorPosition={position}
          onChannelClick={(id) => navigate(`/library/channels/${id}`)}
          onZoneClick={(id) => navigate(`/library/zones/${id}`)}
        />
      </Stack>
    </ListPage>
  );
}

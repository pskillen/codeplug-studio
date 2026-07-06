import { Group } from '@mantine/core';
import { useMemo, type ReactNode } from 'react';
import type { Channel, Library } from '@core/models/library.ts';
import { channelHasGeolocation } from '@core/domain/mapProjection.ts';
import { coordsToLocator } from '@core/domain/maidenhead.ts';
import { haversineDistanceM } from '@core/domain/geoDistance.ts';
import { BandPillForChannel } from '../components/pills/BandPill.tsx';
import ModePill from '../components/pills/ModePill.tsx';
import type { DataTableColumn, DataTableSortState } from '../components/ui/DataTable.tsx';
import { CHANNEL_OPTIONAL_COLUMNS } from './channelListQueryUtils.ts';
import { distanceLabelForChannel } from './useChannelListFilters.ts';
import { formatChannelRxTxListCell } from '../lib/formatFrequency.ts';
import { dmrContactDisplayName, dmrRxGroupListName } from '../lib/entityRefs.ts';
import { channelModesForFilter } from '../lib/channels.ts';
import type { OperatorPosition } from '../state/operatorPosition.tsx';
import {
  DATATABLE_CALLSIGN_SORT_KEY,
  DATATABLE_NAME_SORT_KEY,
} from '../lib/dataTable/sort.ts';

function percentLabel(value: number | null): string {
  if (value == null) return '—';
  return `${value}%`;
}

export function useLibraryChannelColumns(
  library: Library,
  position: OperatorPosition | null,
): DataTableColumn<Channel>[] {
  return useMemo((): DataTableColumn<Channel>[] => {
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
}

export function useLibraryChannelSortCtx(columns: DataTableColumn<Channel>[]) {
  return useMemo(
    () => ({
      columns,
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
    [columns],
  );
}

export function useLibraryChannelEffectiveSort(
  columnSortOverride: DataTableSortState | null,
  querySortMode: string,
  position: OperatorPosition | null,
  preserveMemberOrder: boolean,
): DataTableSortState | null {
  return useMemo((): DataTableSortState | null => {
    if (preserveMemberOrder && !columnSortOverride) return null;
    if (columnSortOverride) return columnSortOverride;
    if (querySortMode === 'distance' && position) {
      return { columnKey: 'distance', direction: 'asc' };
    }
    return { columnKey: DATATABLE_NAME_SORT_KEY, direction: 'asc' };
  }, [columnSortOverride, preserveMemberOrder, position, querySortMode]);
}

export type LibraryChannelTableToolbar = ReactNode;

export { DATATABLE_CALLSIGN_SORT_KEY, DATATABLE_NAME_SORT_KEY };

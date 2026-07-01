import { useMemo } from 'react';
import type { Channel } from '@core/models/library.ts';
import { channelHasGeolocation } from '@core/domain/mapProjection.ts';
import { formatDistanceM, haversineDistanceM } from '@core/domain/geoDistance.ts';
import { channelMatchesBandFilter } from '../lib/bands.ts';
import {
  channelMatchesModeFilter,
  filterChannelsByDistance,
  isSimplex,
  sortByName,
} from '../lib/channels.ts';
import type { OperatorPosition } from '../state/operatorPosition.tsx';
import type { ChannelListQuery } from './useChannelListQuery.ts';
import type { ChannelSortMode } from './channelListQueryUtils.ts';

export function sortChannelsByMode(
  rows: Channel[],
  sortMode: ChannelSortMode,
  position: OperatorPosition | null,
): Channel[] {
  if (sortMode === 'name' || !position) {
    return sortByName(rows);
  }

  const located: Channel[] = [];
  const unlocated: Channel[] = [];

  for (const ch of rows) {
    if (channelHasGeolocation(ch)) located.push(ch);
    else unlocated.push(ch);
  }

  located.sort((a, b) => {
    const da = haversineDistanceM(position.lat, position.lon, a.location!.lat, a.location!.lon);
    const db = haversineDistanceM(position.lat, position.lon, b.location!.lat, b.location!.lon);
    return da - db;
  });

  return [...located, ...sortByName(unlocated)];
}

export function filterChannelsForList(
  channels: Channel[],
  query: Pick<
    ChannelListQuery,
    | 'nameFilter'
    | 'bandFilter'
    | 'modeFilter'
    | 'duplexFilter'
    | 'distanceFilterEnabled'
    | 'maxDistanceKm'
    | 'sortMode'
  >,
  position: OperatorPosition | null,
  options?: { skipSort?: boolean },
): Channel[] {
  const nameFiltered = channels.filter((ch) => {
    if (query.nameFilter) {
      const q = query.nameFilter.toLowerCase();
      const matchesName = ch.name.toLowerCase().includes(q);
      const matchesCallsign = ch.callsign.toLowerCase().includes(q);
      if (!matchesName && !matchesCallsign) return false;
    }
    if (!channelMatchesBandFilter(ch.rxFrequency, ch.txFrequency, query.bandFilter)) return false;
    if (query.modeFilter.length && !channelMatchesModeFilter(ch, query.modeFilter)) return false;
    if (query.duplexFilter === 'simplex' && !isSimplex(ch.rxFrequency, ch.txFrequency))
      return false;
    if (query.duplexFilter === 'split' && isSimplex(ch.rxFrequency, ch.txFrequency)) return false;
    return true;
  });

  const distanceFiltered = filterChannelsByDistance(nameFiltered, {
    enabled: query.distanceFilterEnabled,
    operatorPosition: position,
    maxDistanceKm: query.maxDistanceKm,
  });

  if (options?.skipSort) return distanceFiltered;
  return sortChannelsByMode(distanceFiltered, query.sortMode, position);
}

export function useFilteredChannels(
  channels: Channel[],
  query: ChannelListQuery,
  position: OperatorPosition | null,
  options?: { skipSort?: boolean },
): Channel[] {
  return useMemo(
    () => filterChannelsForList(channels, query, position, options),
    [
      channels,
      query.nameFilter,
      query.bandFilter,
      query.modeFilter,
      query.duplexFilter,
      query.distanceFilterEnabled,
      query.maxDistanceKm,
      query.sortMode,
      position,
      options?.skipSort,
    ],
  );
}

export function distanceLabelForChannel(channel: Channel, position: OperatorPosition): string {
  if (!channelHasGeolocation(channel)) return '—';
  return formatDistanceM(
    haversineDistanceM(position.lat, position.lon, channel.location!.lat, channel.location!.lon),
  );
}

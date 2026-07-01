import type { Channel } from '@core/models/library.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { channelHasGeolocation } from '@core/domain/mapProjection.ts';
import { haversineDistanceM } from '@core/domain/geoDistance.ts';

/** Kilometre marks for the channel-list distance filter slider. */
export const DISTANCE_FILTER_MARKS_KM = [5, 10, 25, 50, 100, 200] as const;

export function channelModesForFilter(channel: Channel): ChannelMode[] {
  if (channel.modeProfiles.length > 0) {
    return channel.modeProfiles.map((p) => p.mode);
  }
  return ['fm'];
}

export function channelMatchesModeFilter(channel: Channel, modeFilter: string[]): boolean {
  if (!modeFilter.length) return true;
  const modes = channelModesForFilter(channel);
  return modeFilter.some((m) => modes.includes(m as ChannelMode));
}

export function isSimplex(rxHz: number | null, txHz: number | null): boolean {
  if (rxHz == null || txHz == null) return false;
  return rxHz === txHz;
}

export function filterChannelsByDistance(
  channels: Channel[],
  options: {
    enabled: boolean;
    operatorPosition: { lat: number; lon: number } | null;
    maxDistanceKm: number;
  },
): Channel[] {
  const { enabled, operatorPosition, maxDistanceKm } = options;
  if (!enabled) return channels;

  return channels.filter((ch) => {
    if (!channelHasGeolocation(ch)) return false;
    if (!operatorPosition) return true;
    const metres = haversineDistanceM(
      operatorPosition.lat,
      operatorPosition.lon,
      ch.location!.lat,
      ch.location!.lon,
    );
    return metres <= maxDistanceKm * 1000;
  });
}

export function sortByName<T extends { name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

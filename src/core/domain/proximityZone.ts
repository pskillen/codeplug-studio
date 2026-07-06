import type { Channel, ZoneMemberEntry } from '../models/library.ts';
import { haversineDistanceM } from './geoDistance.ts';
import { channelHasGeolocation } from './mapProjection.ts';

export interface ProximityCenter {
  lat: number;
  lon: number;
}

export interface ProximitySelectionResult {
  /** Channel ids within radius, nearest first (name tie-break). */
  channelIds: string[];
  distancesM: Map<string, number>;
}

export function selectChannelsWithinRadius(
  channels: Channel[],
  center: ProximityCenter,
  radiusKm: number,
): ProximitySelectionResult {
  const radiusM = radiusKm * 1000;
  const matches: { channel: Channel; distanceM: number }[] = [];

  for (const channel of channels) {
    if (!channelHasGeolocation(channel)) continue;
    const distanceM = haversineDistanceM(
      center.lat,
      center.lon,
      channel.location!.lat,
      channel.location!.lon,
    );
    if (distanceM <= radiusM) {
      matches.push({ channel, distanceM });
    }
  }

  matches.sort((a, b) => {
    const byDistance = a.distanceM - b.distanceM;
    if (byDistance !== 0) return byDistance;
    return a.channel.name.localeCompare(b.channel.name, undefined, { sensitivity: 'base' });
  });

  const distancesM = new Map<string, number>();
  const channelIds: string[] = [];
  for (const { channel, distanceM } of matches) {
    channelIds.push(channel.id);
    distancesM.set(channel.id, distanceM);
  }

  return { channelIds, distancesM };
}

export function zoneMembersFromChannelIds(channelIds: string[]): ZoneMemberEntry[] {
  return channelIds.map((channelId) => ({ kind: 'channel', channelId }));
}

import type { Channel, Zone } from '@core/models/library.ts';
import { zonesWithDirectChannelMember } from '@core/domain/zoneMembership.ts';

export interface ChannelZoneGroup {
  key: string;
  /** `null` for the "No Zone" group. */
  zone: Zone | null;
  channels: Channel[];
}

/**
 * Buckets channels by direct zone membership for the channels list's Group by
 * Zone view. A channel that's a direct member of multiple zones appears once
 * per zone (intentional duplication, per #971) — channels with no direct
 * membership land in a single "No Zone" group. Empty zone groups are omitted.
 */
export function groupChannelsByZone(channels: Channel[], zones: Zone[]): ChannelZoneGroup[] {
  const channelsByZoneId = new Map<string, Channel[]>();
  const noZoneChannels: Channel[] = [];

  for (const channel of channels) {
    const directZones = zonesWithDirectChannelMember(channel.id, zones);
    if (directZones.length === 0) {
      noZoneChannels.push(channel);
      continue;
    }
    for (const zone of directZones) {
      const existing = channelsByZoneId.get(zone.id);
      if (existing) {
        existing.push(channel);
      } else {
        channelsByZoneId.set(zone.id, [channel]);
      }
    }
  }

  const zoneGroups = zones
    .filter((zone) => channelsByZoneId.has(zone.id))
    .map((zone): ChannelZoneGroup => ({
      key: `zone:${zone.id}`,
      zone,
      channels: channelsByZoneId.get(zone.id)!,
    }))
    .sort((a, b) => {
      const orderA = a.zone!.order ?? Number.POSITIVE_INFINITY;
      const orderB = b.zone!.order ?? Number.POSITIVE_INFINITY;
      if (orderA !== orderB) return orderA - orderB;
      return a.zone!.name.localeCompare(b.zone!.name, undefined, { sensitivity: 'base' });
    });

  if (noZoneChannels.length > 0) {
    zoneGroups.push({ key: 'no-zone', zone: null, channels: noZoneChannels });
  }

  return zoneGroups;
}

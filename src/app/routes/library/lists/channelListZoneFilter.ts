import type { Channel, Zone } from '@core/models/library.ts';
import { zonesWithDirectChannelMember } from '@core/domain/zoneMembership.ts';

/** Sentinel in `zoneFilter` for channels with no direct zone membership. */
export const CHANNEL_ZONE_FILTER_NONE = 'none';

export function channelMatchesZoneFilter(
  channel: Channel,
  zoneFilter: string[],
  zones: Zone[],
): boolean {
  if (zoneFilter.length === 0) return true;

  const directZones = zonesWithDirectChannelMember(channel.id, zones);
  const wantsNone = zoneFilter.includes(CHANNEL_ZONE_FILTER_NONE);
  const selectedZoneIds = zoneFilter.filter((id) => id !== CHANNEL_ZONE_FILTER_NONE);
  const inSelectedZone = directZones.some((zone) => selectedZoneIds.includes(zone.id));
  const inNoZone = directZones.length === 0;

  return inSelectedZone || (wantsNone && inNoZone);
}

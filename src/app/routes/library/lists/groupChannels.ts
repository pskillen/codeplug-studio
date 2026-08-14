import type { Channel, Zone } from '@core/models/library.ts';
import type { ChannelListCardGroupMode } from '@integrations/listPrefs/index.ts';
import { ALL_BANDS, bandFromChannel } from '../../../lib/bands.ts';
import { isSimplex } from '../../../lib/channels.ts';
import { CHANNEL_ZONE_FILTER_NONE } from './channelListZoneFilter.ts';
import { groupChannelsByZone, type ChannelZoneGroup } from './groupChannelsByZone.ts';

export type { ChannelListCardGroupMode as ChannelCardGroupMode } from '@integrations/listPrefs/index.ts';

export interface ChannelListGroup {
  key: string;
  title: string;
  channels: Channel[];
}

function zoneGroupTitle(group: ChannelZoneGroup): string {
  return group.zone?.name ?? 'No Zone';
}

function zoneGroupsToListGroups(groups: ChannelZoneGroup[]): ChannelListGroup[] {
  return groups.map((group) => ({
    key: group.key,
    title: zoneGroupTitle(group),
    channels: group.channels,
  }));
}

function filterZoneGroupsByZoneFilter(
  groups: ChannelZoneGroup[],
  zoneFilter: string[],
): ChannelZoneGroup[] {
  if (zoneFilter.length === 0) return groups;

  const selectedZoneIds = new Set(
    zoneFilter.filter((id) => id !== CHANNEL_ZONE_FILTER_NONE),
  );
  const includeNoZone = zoneFilter.includes(CHANNEL_ZONE_FILTER_NONE);

  return groups.filter((group) => {
    if (group.zone === null) return includeNoZone;
    return selectedZoneIds.has(group.zone.id);
  });
}

export function groupChannelsByBand(channels: Channel[]): ChannelListGroup[] {
  const byBandId = new Map<string, Channel[]>();
  const unknown: Channel[] = [];

  for (const channel of channels) {
    const band = bandFromChannel(channel.rxFrequency, channel.txFrequency);
    if (!band) {
      unknown.push(channel);
      continue;
    }
    const existing = byBandId.get(band.id);
    if (existing) {
      existing.push(channel);
    } else {
      byBandId.set(band.id, [channel]);
    }
  }

  const groups: ChannelListGroup[] = [];

  for (const band of ALL_BANDS) {
    const bandChannels = byBandId.get(band.id);
    if (!bandChannels?.length) continue;
    groups.push({
      key: `band:${band.id}`,
      title: band.label,
      channels: bandChannels,
    });
  }

  if (unknown.length > 0) {
    groups.push({
      key: 'band:unknown',
      title: 'Unknown band',
      channels: unknown,
    });
  }

  return groups;
}

export function groupChannelsByDuplex(channels: Channel[]): ChannelListGroup[] {
  const simplex: Channel[] = [];
  const split: Channel[] = [];

  for (const channel of channels) {
    if (isSimplex(channel.rxFrequency, channel.txFrequency)) {
      simplex.push(channel);
    } else {
      split.push(channel);
    }
  }

  const groups: ChannelListGroup[] = [];
  if (simplex.length > 0) {
    groups.push({ key: 'duplex:simplex', title: 'Simplex', channels: simplex });
  }
  if (split.length > 0) {
    groups.push({ key: 'duplex:split', title: 'Split', channels: split });
  }
  return groups;
}

export function groupChannelsForCardView(
  channels: Channel[],
  zones: Zone[],
  groupMode: Exclude<ChannelListCardGroupMode, 'none'>,
  zoneFilter: string[] = [],
): ChannelListGroup[] {
  switch (groupMode) {
    case 'zone': {
      const zoneGroups = filterZoneGroupsByZoneFilter(
        groupChannelsByZone(channels, zones),
        zoneFilter,
      );
      return zoneGroupsToListGroups(zoneGroups);
    }
    case 'band':
      return groupChannelsByBand(channels);
    case 'duplex':
      return groupChannelsByDuplex(channels);
    default:
      return [];
  }
}

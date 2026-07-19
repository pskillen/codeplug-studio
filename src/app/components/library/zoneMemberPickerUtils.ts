import type { Channel, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import {
  resolveEffectiveZoneChannelIds,
  type ZoneMembershipExclusionReason,
} from '@core/domain/zoneHierarchy.ts';
import { entryFromMemberKey, memberKeysFromMembers } from './zoneMembers.ts';

export interface ZoneMemberPickerMapFilters {
  /** Omit from map channel markers */
  hiddenMarkerChannelIds: string[];
  /** Omit from zone hull preview (in-zone members only) */
  hiddenZoneMemberIds: string[];
}

/** Operator-facing label for why a zone cannot be added as a nested member. */
export function zoneMembershipExclusionLabel(reason: ZoneMembershipExclusionReason): string {
  switch (reason) {
    case 'self':
      return 'This zone';
    case 'descendant':
      return 'Already nested under this zone';
    case 'cycle':
      return 'Would create a cycle';
  }
}

/** Case-insensitive match on channel name or callsign. */
export function channelMatchesZoneMemberFilter(channel: Channel, filterLower: string): boolean {
  if (!filterLower) return true;
  const name = channel.name.toLowerCase();
  const callsign = (channel.callsign ?? '').toLowerCase();
  return name.includes(filterLower) || callsign.includes(filterLower);
}

function zoneMatchesFilter(zone: Zone, filterLower: string): boolean {
  if (!filterLower) return true;
  return zone.name.toLowerCase().includes(filterLower);
}

export function computeZoneMemberPickerMapFilters(
  channels: Channel[],
  selectedChannelIds: string[],
  availableFilter: string,
  inZoneFilter: string,
  hideAvailableFilteredFromMap: boolean,
  hideInZoneFilteredFromMap: boolean,
  members: ZoneMemberEntry[],
  zones: Zone[],
): ZoneMemberPickerMapFilters {
  const selectedIdSet = new Set(selectedChannelIds);
  const availableFilterLower = availableFilter.trim().toLowerCase();
  const inZoneFilterLower = inZoneFilter.trim().toLowerCase();
  const hiddenMarkerChannelIds: string[] = [];
  const hiddenZoneMemberIds: string[] = [];

  if (hideAvailableFilteredFromMap && availableFilterLower) {
    for (const ch of channels) {
      if (!selectedIdSet.has(ch.id) && !channelMatchesZoneMemberFilter(ch, availableFilterLower)) {
        hiddenMarkerChannelIds.push(ch.id);
      }
    }
  }

  if (hideInZoneFilteredFromMap && inZoneFilterLower) {
    const memberKeys = memberKeysFromMembers(members);
    for (const key of memberKeys) {
      const entry = entryFromMemberKey(key);
      if (entry.kind === 'channel') {
        const ch = channels.find((row) => row.id === entry.channelId);
        if (ch && !channelMatchesZoneMemberFilter(ch, inZoneFilterLower)) {
          hiddenMarkerChannelIds.push(ch.id);
          hiddenZoneMemberIds.push(ch.id);
        }
        continue;
      }
      const zone = zones.find((row) => row.id === entry.zoneId);
      if (zone && !zoneMatchesFilter(zone, inZoneFilterLower)) {
        const effective = resolveEffectiveZoneChannelIds(zone, zones);
        for (const channelId of effective) {
          hiddenMarkerChannelIds.push(channelId);
          hiddenZoneMemberIds.push(channelId);
        }
      }
    }
  }

  return { hiddenMarkerChannelIds, hiddenZoneMemberIds };
}

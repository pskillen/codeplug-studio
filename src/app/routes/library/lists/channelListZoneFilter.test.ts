import { describe, expect, it } from 'vitest';
import type { Zone } from '@core/models/library.ts';
import { newChannel, newZone } from '@core/domain/factories.ts';
import {
  CHANNEL_ZONE_FILTER_NONE,
  channelMatchesZoneFilter,
} from './channelListZoneFilter.ts';

function withMembers(zone: Zone, channelIds: string[]): Zone {
  return { ...zone, members: channelIds.map((channelId) => ({ kind: 'channel', channelId })) };
}

describe('channelMatchesZoneFilter', () => {
  const chInZone = newChannel('p1', 'In zone');
  const chNoZone = newChannel('p1', 'No zone');
  const zoneA = withMembers(newZone('p1', 'Zone A'), [chInZone.id]);

  it('matches all channels when the filter is empty', () => {
    expect(channelMatchesZoneFilter(chInZone, [], [zoneA])).toBe(true);
    expect(channelMatchesZoneFilter(chNoZone, [], [zoneA])).toBe(true);
  });

  it('matches channels in a selected zone', () => {
    expect(channelMatchesZoneFilter(chInZone, [zoneA.id], [zoneA])).toBe(true);
    expect(channelMatchesZoneFilter(chNoZone, [zoneA.id], [zoneA])).toBe(false);
  });

  it('matches channels with no direct membership when none is selected', () => {
    expect(channelMatchesZoneFilter(chNoZone, [CHANNEL_ZONE_FILTER_NONE], [zoneA])).toBe(true);
    expect(channelMatchesZoneFilter(chInZone, [CHANNEL_ZONE_FILTER_NONE], [zoneA])).toBe(false);
  });

  it('matches when any selected zone or none applies', () => {
    expect(
      channelMatchesZoneFilter(chInZone, [zoneA.id, CHANNEL_ZONE_FILTER_NONE], [zoneA]),
    ).toBe(true);
    expect(
      channelMatchesZoneFilter(chNoZone, [zoneA.id, CHANNEL_ZONE_FILTER_NONE], [zoneA]),
    ).toBe(true);
  });
});

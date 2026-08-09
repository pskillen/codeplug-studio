import { describe, expect, it } from 'vitest';
import type { Zone } from '@core/models/library.ts';
import { newChannel, newZone } from '@core/domain/factories.ts';
import { groupChannelsByZone } from './groupChannelsByZone.ts';

function withMembers(zone: Zone, channelIds: string[]): Zone {
  return { ...zone, members: channelIds.map((channelId) => ({ kind: 'channel', channelId })) };
}

describe('groupChannelsByZone', () => {
  it('puts every channel in "No Zone" when there are no zones', () => {
    const ch1 = newChannel('p1', 'Channel 1');
    const ch2 = newChannel('p1', 'Channel 2');

    const groups = groupChannelsByZone([ch1, ch2], []);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.zone).toBeNull();
    expect(groups[0]!.channels).toEqual([ch1, ch2]);
  });

  it('groups channels under their zone and leaves unmatched channels in "No Zone"', () => {
    const ch1 = newChannel('p1', 'Channel 1');
    const ch2 = newChannel('p1', 'Channel 2');
    const zoneA = withMembers(newZone('p1', 'Zone A'), [ch1.id]);

    const groups = groupChannelsByZone([ch1, ch2], [zoneA]);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ zone: zoneA, channels: [ch1] });
    expect(groups[1]).toMatchObject({ zone: null, channels: [ch2] });
  });

  it('duplicates a channel across every zone it is a direct member of', () => {
    const ch1 = newChannel('p1', 'Channel 1');
    const zoneA = withMembers(newZone('p1', 'Zone A'), [ch1.id]);
    const zoneB = withMembers(newZone('p1', 'Zone B'), [ch1.id]);

    const groups = groupChannelsByZone([ch1], [zoneA, zoneB]);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.zone?.name)).toEqual(['Zone A', 'Zone B']);
    expect(groups.map((g) => g.channels)).toEqual([[ch1], [ch1]]);
  });

  it('omits zones with no matching channels', () => {
    const ch1 = newChannel('p1', 'Channel 1');
    const zoneA = withMembers(newZone('p1', 'Zone A'), [ch1.id]);
    const zoneEmpty = newZone('p1', 'Zone Empty');

    const groups = groupChannelsByZone([ch1], [zoneA, zoneEmpty]);

    expect(groups.map((g) => g.zone?.name)).toEqual(['Zone A']);
  });

  it('returns no groups for an empty channel list', () => {
    const zoneA = newZone('p1', 'Zone A');

    expect(groupChannelsByZone([], [zoneA])).toEqual([]);
  });

  it('sorts zone groups by order then name, with "No Zone" always last', () => {
    const ch1 = newChannel('p1', 'Channel 1');
    const ch2 = newChannel('p1', 'Channel 2');
    const ch3 = newChannel('p1', 'Channel 3');
    const zoneUnordered = withMembers({ ...newZone('p1', 'Zulu'), order: undefined }, [ch1.id]);
    const zoneFirst = withMembers({ ...newZone('p1', 'Bravo'), order: 1 }, [ch2.id]);
    const zoneAlso1 = withMembers({ ...newZone('p1', 'Alpha'), order: 1 }, [ch3.id]);

    const groups = groupChannelsByZone([ch1, ch2, ch3], [zoneUnordered, zoneFirst, zoneAlso1]);

    expect(groups.map((g) => g.zone?.name)).toEqual(['Alpha', 'Bravo', 'Zulu']);
  });
});

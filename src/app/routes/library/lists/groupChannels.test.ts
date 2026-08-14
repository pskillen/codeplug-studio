import { describe, expect, it } from 'vitest';
import type { Zone } from '@core/models/library.ts';
import { newChannel, newZone } from '@core/domain/factories.ts';
import { CHANNEL_ZONE_FILTER_NONE } from './channelListZoneFilter.ts';
import {
  groupChannelsByBand,
  groupChannelsByDuplex,
  groupChannelsForCardView,
} from './groupChannels.ts';

function withMembers(zone: Zone, channelIds: string[]): Zone {
  return { ...zone, members: channelIds.map((channelId) => ({ kind: 'channel', channelId })) };
}

describe('groupChannelsByBand', () => {
  it('groups channels by primary band and puts unknown frequencies last', () => {
    const ch2m = newChannel('p1', '2m FM', 'GB3TEST');
    ch2m.rxFrequency = 145_000_000;
    ch2m.txFrequency = 145_000_000;
    const ch70cm = newChannel('p1', '70cm', 'GB3HAM');
    ch70cm.rxFrequency = 430_000_000;
    ch70cm.txFrequency = 430_000_000;
    const chUnknown = newChannel('p1', 'No freq');

    const groups = groupChannelsByBand([ch2m, ch70cm, chUnknown]);

    expect(groups.map((g) => g.title)).toEqual(['2 m', '70 cm', 'Unknown band']);
    expect(groups[0]!.channels).toEqual([ch2m]);
    expect(groups[2]!.channels).toEqual([chUnknown]);
  });
});

describe('groupChannelsByDuplex', () => {
  it('splits simplex and split channels', () => {
    const simplex = newChannel('p1', 'Simplex');
    simplex.rxFrequency = 145_000_000;
    simplex.txFrequency = 145_000_000;
    const split = newChannel('p1', 'Split');
    split.rxFrequency = 145_000_000;
    split.txFrequency = 145_600_000;

    const groups = groupChannelsByDuplex([simplex, split]);

    expect(groups.map((g) => g.title)).toEqual(['Simplex', 'Split']);
    expect(groups[0]!.channels).toEqual([simplex]);
    expect(groups[1]!.channels).toEqual([split]);
  });
});

describe('groupChannelsForCardView', () => {
  it('omits unselected zone sections when a zone filter is active', () => {
    const ch1 = newChannel('p1', 'Channel 1');
    const zoneA = withMembers(newZone('p1', 'Zone A'), [ch1.id]);
    const zoneB = withMembers(newZone('p1', 'Zone B'), []);

    const groups = groupChannelsForCardView([ch1], [zoneA, zoneB], 'zone', [zoneA.id]);

    expect(groups.map((g) => g.title)).toEqual(['Zone A']);
  });

  it('includes No Zone when the none sentinel is in the zone filter', () => {
    const ch1 = newChannel('p1', 'Channel 1');
    const ch2 = newChannel('p1', 'Channel 2');
    const zoneA = withMembers(newZone('p1', 'Zone A'), [ch1.id]);

    const groups = groupChannelsForCardView([ch1, ch2], [zoneA], 'zone', [
      zoneA.id,
      CHANNEL_ZONE_FILTER_NONE,
    ]);

    expect(groups.map((g) => g.title)).toEqual(['Zone A', 'No Zone']);
    expect(groups[1]!.channels).toEqual([ch2]);
  });
});

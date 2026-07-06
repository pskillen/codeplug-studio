import { describe, expect, it } from 'vitest';
import type { Channel } from '../models/library.ts';
import { newChannel } from './factories.ts';
import { selectChannelsWithinRadius, zoneMembersFromChannelIds } from './proximityZone.ts';

const PROJECT_ID = 'proj-test';

function locatedChannel(
  name: string,
  lat: number,
  lon: number,
  overrides: Partial<Channel> = {},
): Channel {
  return {
    ...newChannel(PROJECT_ID, name),
    useLocation: true,
    location: { lat, lon },
    ...overrides,
  };
}

describe('selectChannelsWithinRadius', () => {
  const center = { lat: 55.8642, lon: -4.2518 };

  it('returns empty result for no channels', () => {
    expect(selectChannelsWithinRadius([], center, 25)).toEqual({
      channelIds: [],
      distancesM: new Map(),
    });
  });

  it('excludes channels without geolocation', () => {
    const noCoords = newChannel(PROJECT_ID, 'No coords');
    const zeroUse = locatedChannel('Off', center.lat, center.lon, { useLocation: false });
    const result = selectChannelsWithinRadius([noCoords, zeroUse], center, 25);
    expect(result.channelIds).toEqual([]);
  });

  it('includes channels within radius sorted nearest first', () => {
    const near = locatedChannel('Near', center.lat + 0.01, center.lon);
    const mid = locatedChannel('Mid', center.lat + 0.05, center.lon);
    const far = locatedChannel('Far', center.lat + 0.5, center.lon);

    const result = selectChannelsWithinRadius([far, mid, near], center, 25);
    expect(result.channelIds).toEqual([near.id, mid.id]);
    expect(result.distancesM.get(near.id)).toBeLessThan(result.distancesM.get(mid.id)!);
  });

  it('includes channel at reference point and excludes beyond radius', () => {
    const here = locatedChannel('Here', center.lat, center.lon);
    const far = locatedChannel('Far', center.lat + 1, center.lon);
    const nearResult = selectChannelsWithinRadius([here], center, 1);
    expect(nearResult.channelIds).toEqual([here.id]);
    expect(nearResult.distancesM.get(here.id)).toBe(0);

    const farResult = selectChannelsWithinRadius([far], center, 10);
    expect(farResult.channelIds).toEqual([]);
  });

  it('tie-breaks equal distances by channel name', () => {
    const a = locatedChannel('Alpha', center.lat + 0.01, center.lon);
    const b = locatedChannel('Bravo', center.lat + 0.01, center.lon);
    const result = selectChannelsWithinRadius([b, a], center, 25);
    expect(result.channelIds).toEqual([a.id, b.id]);
  });
});

describe('zoneMembersFromChannelIds', () => {
  it('maps ids to channel member entries', () => {
    expect(zoneMembersFromChannelIds(['a', 'b'])).toEqual([
      { kind: 'channel', channelId: 'a' },
      { kind: 'channel', channelId: 'b' },
    ]);
  });
});

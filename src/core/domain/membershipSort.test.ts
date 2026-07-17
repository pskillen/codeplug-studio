import { describe, expect, it } from 'vitest';
import { newChannel, newZone } from '@core/domain/factories.ts';
import {
  sortChannelIdsByMode,
  sortZoneMembersByMode,
  sortZonesByName,
} from './membershipSort.ts';

describe('membershipSort', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';

  it('sorts channel ids by name', () => {
    const a = { ...newChannel(projectId, 'Bravo'), id: 'a' };
    const b = { ...newChannel(projectId, 'Alpha'), id: 'b' };
    const byId = new Map([
      [a.id, a],
      [b.id, b],
    ]);
    expect(sortChannelIdsByMode(['a', 'b'], byId, 'name')).toEqual(['b', 'a']);
  });

  it('sorts simplex before split', () => {
    const simplex = {
      ...newChannel(projectId, 'S'),
      id: 's',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
    };
    const split = {
      ...newChannel(projectId, 'R'),
      id: 'r',
      rxFrequency: 145_600_000,
      txFrequency: 145_000_000,
    };
    const byId = new Map([
      [simplex.id, simplex],
      [split.id, split],
    ]);
    expect(sortChannelIdsByMode(['r', 's'], byId, 'duplex')).toEqual(['s', 'r']);
  });

  it('sorts zone members and places channels before nested zones', () => {
    const ch = { ...newChannel(projectId, 'Zulu'), id: 'ch-1' };
    const nested = { ...newZone(projectId, 'Alpha'), id: 'zone-nested' };
    const members = [
      { kind: 'zone' as const, zoneId: nested.id },
      { kind: 'channel' as const, channelId: ch.id },
    ];
    const next = sortZoneMembersByMode(
      members,
      new Map([[ch.id, ch]]),
      new Map([[nested.id, nested]]),
      'name',
    );
    expect(next[0]).toEqual({ kind: 'channel', channelId: 'ch-1' });
    expect(next[1]).toEqual({ kind: 'zone', zoneId: 'zone-nested' });
  });

  it('sortZonesByName applies dense order', () => {
    const zones = [
      { ...newZone(projectId, 'Zulu'), id: 'z' },
      { ...newZone(projectId, 'Alpha'), id: 'a' },
    ];
    const next = sortZonesByName(zones);
    expect(next.find((z) => z.id === 'a')?.order).toBe(1);
    expect(next.find((z) => z.id === 'z')?.order).toBe(2);
  });
});

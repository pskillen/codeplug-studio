import { describe, expect, it } from 'vitest';
import type { Library, Zone } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import {
  addChannelsToZoneMembers,
  addZonesToZoneMembers,
  channelInAnyZoneMembership,
  channelsNotInAnyZone,
  removeChannelsFromZoneMembers,
  reorderZoneMembers,
  setChannelMemberIncludeInScanList,
  unzonedChannelIds,
  zonesWithDirectChannelMember,
  zonesWithEffectiveChannelMembership,
} from './zoneMembership.ts';

function zone(id: string, name: string, members: Zone['members']): Zone {
  return {
    id,
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name,
    members,
    comment: '',
  };
}

function library(channels: string[], zones: Zone[]): Library {
  return {
    channels: channels.map((id) => ({ ...newChannel('p1', id), id })),
    analogContacts: [],
    talkGroups: [],
    digitalContacts: [],
    rxGroupLists: [],
    scanLists: [],
    zones,
  };
}

describe('channelInAnyZoneMembership', () => {
  it('detects direct and nested membership', () => {
    const child = zone('z-child', 'Child', [{ kind: 'channel', channelId: 'ch-nested' }]);
    const parent = zone('z-parent', 'Parent', [{ kind: 'zone', zoneId: 'z-child' }]);
    const lib = library(
      ['ch-direct', 'ch-nested', 'ch-orphan'],
      [zone('z-direct', 'Direct', [{ kind: 'channel', channelId: 'ch-direct' }]), child, parent],
    );

    expect(channelInAnyZoneMembership('ch-direct', lib)).toBe(true);
    expect(channelInAnyZoneMembership('ch-nested', lib)).toBe(true);
    expect(channelInAnyZoneMembership('ch-orphan', lib)).toBe(false);
  });
});

describe('zonesWithDirectChannelMember', () => {
  it('returns only zones with direct channel members', () => {
    const child = zone('z-child', 'Child', [{ kind: 'channel', channelId: 'ch-1' }]);
    const parent = zone('z-parent', 'Parent', [{ kind: 'zone', zoneId: 'z-child' }]);
    const lib = library(['ch-1'], [child, parent]);

    expect(zonesWithDirectChannelMember('ch-1', lib.zones).map((z) => z.id)).toEqual(['z-child']);
  });
});

describe('zonesWithEffectiveChannelMembership', () => {
  it('separates direct and nested-only membership', () => {
    const child = zone('z-child', 'Scotland', [{ kind: 'channel', channelId: 'ch-1' }]);
    const parent = zone('z-parent', 'UK Regions', [{ kind: 'zone', zoneId: 'z-child' }]);
    const lib = library(['ch-1'], [child, parent]);

    const memberships = zonesWithEffectiveChannelMembership('ch-1', lib);
    expect(memberships).toHaveLength(2);

    const direct = memberships.find((m) => m.zone.id === 'z-child');
    expect(direct?.direct).toBe(true);

    const nested = memberships.find((m) => m.zone.id === 'z-parent');
    expect(nested?.direct).toBe(false);
    expect(nested?.viaNestedZoneName).toBe('Scotland');
  });
});

describe('unzonedChannelIds', () => {
  it('returns channels in no zone', () => {
    const lib = library(
      ['ch-1', 'ch-2'],
      [zone('z-1', 'One', [{ kind: 'channel', channelId: 'ch-1' }])],
    );
    expect(unzonedChannelIds(lib)).toEqual(['ch-2']);
    expect(channelsNotInAnyZone(lib).map((ch) => ch.id)).toEqual(['ch-2']);
  });
});

describe('addChannelsToZoneMembers', () => {
  it('appends new channels and skips duplicates', () => {
    const members = [{ kind: 'channel' as const, channelId: 'ch-1' }];
    const next = addChannelsToZoneMembers(members, ['ch-2', 'ch-1', 'ch-3']);
    expect(next).toEqual([
      { kind: 'channel', channelId: 'ch-1' },
      { kind: 'channel', channelId: 'ch-2' },
      { kind: 'channel', channelId: 'ch-3' },
    ]);
  });
});

describe('removeChannelsFromZoneMembers', () => {
  it('removes only matching channel members', () => {
    const members = [
      { kind: 'channel' as const, channelId: 'ch-1' },
      { kind: 'zone' as const, zoneId: 'z-child' },
      { kind: 'channel' as const, channelId: 'ch-2' },
    ];
    expect(removeChannelsFromZoneMembers(members, ['ch-1'])).toEqual([
      { kind: 'zone', zoneId: 'z-child' },
      { kind: 'channel', channelId: 'ch-2' },
    ]);
  });
});

describe('addZonesToZoneMembers', () => {
  it('appends nested zones without duplicates', () => {
    const members = [{ kind: 'zone' as const, zoneId: 'z-a' }];
    expect(addZonesToZoneMembers(members, ['z-b', 'z-a'])).toEqual([
      { kind: 'zone', zoneId: 'z-a' },
      { kind: 'zone', zoneId: 'z-b' },
    ]);
  });
});

describe('reorderZoneMembers', () => {
  it('moves selected channel block up', () => {
    const members = [
      { kind: 'channel' as const, channelId: 'ch-1' },
      { kind: 'channel' as const, channelId: 'ch-2' },
      { kind: 'channel' as const, channelId: 'ch-3' },
    ];
    const next = reorderZoneMembers(members, new Set(['channel:ch-2']), 'up');
    expect(
      next
        .filter((m): m is { kind: 'channel'; channelId: string } => m.kind === 'channel')
        .map((m) => m.channelId),
    ).toEqual(['ch-2', 'ch-1', 'ch-3']);
  });
});

describe('setChannelMemberIncludeInScanList', () => {
  it('sets and clears includeInScanList on channel members', () => {
    const members = [{ kind: 'channel' as const, channelId: 'ch-1' }];
    const excluded = setChannelMemberIncludeInScanList(members, 'ch-1', false);
    expect(excluded[0]).toEqual({ kind: 'channel', channelId: 'ch-1', includeInScanList: false });

    const restored = setChannelMemberIncludeInScanList(excluded, 'ch-1', true);
    expect(restored[0]).toEqual({ kind: 'channel', channelId: 'ch-1' });
  });
});

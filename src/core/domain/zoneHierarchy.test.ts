import { describe, expect, it } from 'vitest';
import type { Library, Zone } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import {
  flattenZoneMembership,
  resolveEffectiveZoneChannelIds,
  zoneIdsExcludedFromMembership,
  zoneMembershipHasCycle,
} from './zoneHierarchy.ts';
import { directZoneMemberChannelIds } from './zoneMembers.ts';

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

function library(zones: Zone[], channelIds: string[] = []): Library {
  return {
    channels: channelIds.map((id) => ({ ...newChannel('p1', id), id })),
    analogContacts: [],
    talkGroups: [],
    digitalContacts: [],
    rxGroupLists: [],
    scanLists: [],
    aprsConfiguration: null,
    zones,
  };
}

describe('resolveEffectiveZoneChannelIds', () => {
  it('returns direct channel members in order', () => {
    const glasgow = zone('z-g', 'Glasgow', [
      { kind: 'channel', channelId: 'ch-1' },
      { kind: 'channel', channelId: 'ch-2' },
    ]);
    expect(resolveEffectiveZoneChannelIds(glasgow, [glasgow])).toEqual(['ch-1', 'ch-2']);
  });

  it('flattens nested zones depth-first and dedupes channels', () => {
    const glasgow = zone('z-g', 'Glasgow', [{ kind: 'channel', channelId: 'ch-1' }]);
    const edinburgh = zone('z-e', 'Edinburgh', [{ kind: 'channel', channelId: 'ch-2' }]);
    const scotland = zone('z-s', 'Scotland', [
      { kind: 'zone', zoneId: 'z-g' },
      { kind: 'channel', channelId: 'ch-1' },
      { kind: 'zone', zoneId: 'z-e' },
    ]);
    const lib = library([glasgow, edinburgh, scotland], ['ch-1', 'ch-2']);
    expect(resolveEffectiveZoneChannelIds(scotland, lib.zones)).toEqual(['ch-1', 'ch-2']);
  });

  it('returns empty when child zone is missing', () => {
    const parent = zone('z-p', 'Parent', [{ kind: 'zone', zoneId: 'missing' }]);
    expect(resolveEffectiveZoneChannelIds(parent, [parent])).toEqual([]);
  });
});

describe('flattenZoneMembership', () => {
  it('handles Glasgow ↔ PMR446 mutual nesting with partial flatten and warning', () => {
    const pmr446 = zone('z-pmr', 'PMR446', [{ kind: 'channel', channelId: 'ch-pmr' }]);
    const glasgow = zone('z-g', 'Glasgow', [
      { kind: 'channel', channelId: 'ch-g' },
      { kind: 'zone', zoneId: 'z-pmr' },
    ]);
    pmr446.members = [...pmr446.members, { kind: 'zone', zoneId: 'z-g' }];
    const lib = library([glasgow, pmr446], ['ch-g', 'ch-pmr']);

    const result = flattenZoneMembership(glasgow, lib.zones);
    expect(result.channelIds).toEqual(['ch-g', 'ch-pmr']);
    expect(result.cycleWarnings).toHaveLength(1);
    expect(result.cycleWarnings[0]).toContain('Glasgow');
    expect(result.cycleWarnings[0]).toContain('PMR446');
    expect(result.cycleWarnings[0]).toContain('cycle');
  });

  it('returns no cycle warnings for acyclic nested hierarchy', () => {
    const glasgow = zone('z-g', 'Glasgow', [{ kind: 'channel', channelId: 'ch-1' }]);
    const edinburgh = zone('z-e', 'Edinburgh', [{ kind: 'channel', channelId: 'ch-2' }]);
    const scotland = zone('z-s', 'Scotland', [
      { kind: 'zone', zoneId: 'z-g' },
      { kind: 'channel', channelId: 'ch-1' },
      { kind: 'zone', zoneId: 'z-e' },
    ]);
    const lib = library([glasgow, edinburgh, scotland], ['ch-1', 'ch-2']);
    const result = flattenZoneMembership(scotland, lib.zones);
    expect(result.channelIds).toEqual(['ch-1', 'ch-2']);
    expect(result.cycleWarnings).toEqual([]);
  });
});

describe('zoneMembershipHasCycle', () => {
  it('detects direct self-reference', () => {
    const a = zone('z-a', 'A', []);
    expect(zoneMembershipHasCycle('z-a', [{ kind: 'zone', zoneId: 'z-a' }], [a])).toBe(true);
  });

  it('detects indirect cycle', () => {
    const a = zone('z-a', 'A', [{ kind: 'zone', zoneId: 'z-b' }]);
    const b = zone('z-b', 'B', [{ kind: 'zone', zoneId: 'z-a' }]);
    const lib = library([a, b]);
    expect(zoneMembershipHasCycle('z-a', a.members, lib.zones)).toBe(true);
  });

  it('allows acyclic hierarchy', () => {
    const child = zone('z-c', 'Child', [{ kind: 'channel', channelId: 'ch-1' }]);
    const parent = zone('z-p', 'Parent', [{ kind: 'zone', zoneId: 'z-c' }]);
    const lib = library([child, parent], ['ch-1']);
    expect(zoneMembershipHasCycle('z-p', parent.members, lib.zones)).toBe(false);
  });
});

describe('zoneIdsExcludedFromMembership', () => {
  it('includes self and descendant zones', () => {
    const child = zone('z-c', 'Child', []);
    const parent = zone('z-p', 'Parent', [{ kind: 'zone', zoneId: 'z-c' }]);
    const lib = library([child, parent]);
    expect(zoneIdsExcludedFromMembership('z-p', lib.zones)).toEqual(new Set(['z-p', 'z-c']));
  });

  it('uses proposed root members when editing', () => {
    const child = zone('z-c', 'Child', []);
    const parent = zone('z-p', 'Parent', [{ kind: 'zone', zoneId: 'z-c' }]);
    const lib = library([child, parent]);
    expect(zoneIdsExcludedFromMembership('z-p', lib.zones, [])).toEqual(new Set(['z-p']));
  });
});

describe('directZoneMemberChannelIds', () => {
  it('ignores zone members', () => {
    const parent = zone('z-p', 'Parent', [
      { kind: 'zone', zoneId: 'z-c' },
      { kind: 'channel', channelId: 'ch-1' },
    ]);
    expect(directZoneMemberChannelIds(parent)).toEqual(['ch-1']);
  });
});

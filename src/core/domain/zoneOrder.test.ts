import { describe, expect, it } from 'vitest';
import { newFormatBuild, newZone } from '@core/domain/factories.ts';
import {
  applyDenseZoneOrders,
  resolveZoneListOrder,
  sortZonesByExportOrder,
  reorderKeysByDrag,
  reorderZoneIds,
} from './zoneOrder.ts';
import {
  reorderRxGroupListMembers,
  reorderScanListMembers,
  rxGroupListMemberKey,
} from './membershipOrder.ts';
import { assemble } from '@core/services/assemble.ts';
import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';

describe('zoneOrder', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';

  it('sorts by library order then name fallback', () => {
    const a = { ...newZone(projectId, 'Zulu'), id: 'z-a', order: 2 };
    const b = { ...newZone(projectId, 'Alpha'), id: 'z-b' };
    const c = { ...newZone(projectId, 'Bravo'), id: 'z-c', order: 1 };
    expect(sortZonesByExportOrder([a, b, c]).map((z) => z.id)).toEqual(['z-c', 'z-a', 'z-b']);
  });

  it('build orderOrSlot wins over Zone.order', () => {
    const zone = { ...newZone(projectId, 'A'), id: 'z-1', order: 1 };
    expect(resolveZoneListOrder(zone, [{ libraryEntityId: 'z-1', orderOrSlot: 9 }])).toBe(9);
  });

  it('applyDenseZoneOrders rewrites order fields', () => {
    const zones = [
      { ...newZone(projectId, 'A'), id: 'a', order: 9 },
      { ...newZone(projectId, 'B'), id: 'b' },
      { ...newZone(projectId, 'C'), id: 'c', order: 3 },
    ];
    const next = applyDenseZoneOrders(zones, ['b', 'a']);
    expect(next.find((z) => z.id === 'b')?.order).toBe(1);
    expect(next.find((z) => z.id === 'a')?.order).toBe(2);
    expect(next.find((z) => z.id === 'c')?.order).toBeUndefined();
  });

  it('reorderZoneIds moves a selected block', () => {
    expect(reorderZoneIds(['a', 'b', 'c'], new Set(['b']), 'up')).toEqual(['b', 'a', 'c']);
    expect(reorderZoneIds(['a', 'b', 'c'], new Set(['a']), 'down')).toEqual(['b', 'a', 'c']);
  });

  it('reorderKeysByDrag moves a single row (arrayMove semantics)', () => {
    const keys = ['a', 'b', 'c', 'd', 'e'];
    expect(reorderKeysByDrag(keys, 'b', 'd')).toEqual(['a', 'c', 'd', 'b', 'e']);
    expect(reorderKeysByDrag(keys, 'b', 'a')).toEqual(['b', 'a', 'c', 'd', 'e']);
    expect(reorderKeysByDrag(keys, 'e', 'b')).toEqual(['a', 'e', 'b', 'c', 'd']);
  });

  it('reorderKeysByDrag moves a multi-select block', () => {
    const keys = ['a', 'b', 'c', 'd', 'e'];
    const selected = new Set(['b', 'c']);
    expect(reorderKeysByDrag(keys, 'b', 'd', selected)).toEqual(['a', 'd', 'b', 'c', 'e']);
    expect(reorderKeysByDrag(keys, 'b', 'e', selected)).toEqual(['a', 'd', 'e', 'b', 'c']);
    expect(reorderKeysByDrag(keys, 'b', 'a', selected)).toEqual(['b', 'c', 'a', 'd', 'e']);
  });

  it('reorderKeysByDrag is a no-op for invalid or in-block drops', () => {
    const keys = ['a', 'b', 'c'];
    expect(reorderKeysByDrag(keys, 'b', 'b')).toEqual(keys);
    expect(reorderKeysByDrag(keys, 'missing', 'a')).toEqual(keys);
    expect(reorderKeysByDrag(keys, 'b', 'c', new Set(['b', 'c']))).toEqual(keys);
  });
});

describe('membershipOrder', () => {
  it('reorders scan list members', () => {
    expect(reorderScanListMembers(['a', 'b', 'c'], new Set(['c']), 'up')).toEqual(['a', 'c', 'b']);
  });

  it('reorders RX group list members', () => {
    const members = [
      { ref: { kind: 'talkGroup' as const, id: 'tg-1' } },
      { ref: { kind: 'digitalContact' as const, id: 'dc-1' } },
      { ref: { kind: 'talkGroup' as const, id: 'tg-2' } },
    ];
    const key = rxGroupListMemberKey(members[1]!);
    const next = reorderRxGroupListMembers(members, new Set([key]), 'up');
    expect(next.map(rxGroupListMemberKey)).toEqual([
      'digitalContact:dc-1',
      'talkGroup:tg-1',
      'talkGroup:tg-2',
    ]);
  });
});

describe('assemble zone order cascade', () => {
  const projectId = '11111111-1111-4111-8111-111111111111';

  function fmChannel(id: string, name: string): Channel {
    return {
      ...newChannel(projectId, name),
      id,
      modeProfiles: [
        {
          mode: 'fm' as const,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          squelch: null,
          bandwidthKHz: 12.5,
        },
      ],
    };
  }

  it('orders Zones by Zone.order then build override', () => {
    const ch1 = fmChannel('ch-1', 'Ch1');
    const ch2 = fmChannel('ch-2', 'Ch2');
    const zoneA = {
      ...newZone(projectId, 'A'),
      id: 'zone-a',
      order: 2,
      members: [{ kind: 'channel' as const, channelId: 'ch-1' }],
    };
    const zoneB = {
      ...newZone(projectId, 'B'),
      id: 'zone-b',
      order: 1,
      members: [{ kind: 'channel' as const, channelId: 'ch-2' }],
    };
    const build = {
      ...newFormatBuild(projectId, 'opengd77-1701'),
      zoneOverrides: [{ libraryEntityId: 'zone-a', orderOrSlot: 1 }],
    };
    const library = {
      channels: [ch1, ch2],
      zones: [zoneA, zoneB],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const projection = assemble(build, library);
    expect(projection.zones.map((z) => z.zoneId)).toEqual(['zone-a', 'zone-b']);
  });

  it('uses library Zone.order when build has no override', () => {
    const ch1 = fmChannel('ch-1', 'Ch1');
    const ch2 = fmChannel('ch-2', 'Ch2');
    const zoneA = {
      ...newZone(projectId, 'A'),
      id: 'zone-a',
      order: 2,
      members: [{ kind: 'channel' as const, channelId: 'ch-1' }],
    };
    const zoneB = {
      ...newZone(projectId, 'B'),
      id: 'zone-b',
      order: 1,
      members: [{ kind: 'channel' as const, channelId: 'ch-2' }],
    };
    const build = newFormatBuild(projectId, 'opengd77-1701');
    const library = {
      channels: [ch1, ch2],
      zones: [zoneA, zoneB],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const projection = assemble(build, library);
    expect(projection.zones.map((z) => z.zoneId)).toEqual(['zone-b', 'zone-a']);
  });
});

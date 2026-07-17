import { describe, expect, it } from 'vitest';
import type { Zone } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { initialRevision } from '@core/models/revision.ts';
import {
  isZoneMemberOrderOverridden,
  resetZoneMemberOrderToLibrary,
  seedZoneGroupingFromLibrary,
  syncZoneGroupingWithLibrary,
  updateZoneChannelIds,
} from './zoneGroupingLayout.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ZONE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ZONE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CHANNEL = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const CHANNEL_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CHANNEL_3 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function zone(id: string, name: string, channelIds: string[] = [CHANNEL]): Zone {
  return {
    id,
    projectId: PROJECT_ID,
    revision: initialRevision(),
    updatedAt: '2026-07-09T10:00:00.000Z',
    name,
    members: channelIds.map((channelId) => ({ kind: 'channel' as const, channelId })),
    comment: '',
  };
}

function emptyLibrary(zones: Zone[]): LibrarySlice {
  return {
    channels: [],
    zones,
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
}

describe('syncZoneGroupingWithLibrary', () => {
  it('seeds from library when layout is undefined', () => {
    const library = emptyLibrary([zone(ZONE_A, 'Alpha'), zone(ZONE_B, 'Beta')]);
    const synced = syncZoneGroupingWithLibrary(undefined, library);
    expect(synced.zones.map((entry) => entry.id)).toEqual([ZONE_A, ZONE_B]);
  });

  it('adds new library zones and drops removed ones', () => {
    const library = emptyLibrary([zone(ZONE_A, 'Alpha'), zone(ZONE_B, 'Beta')]);
    const layout = seedZoneGroupingFromLibrary(emptyLibrary([zone(ZONE_A, 'Alpha')]));
    layout.zones[0]!.exportScanList = true;
    layout.zones[0]!.scanCarrierFrequencyHz = 430_000_000;

    const synced = syncZoneGroupingWithLibrary(layout, library);
    expect(synced.zones.map((entry) => entry.id)).toEqual([ZONE_A, ZONE_B]);
    expect(synced.zones[0]?.exportScanList).toBe(true);
    expect(synced.zones[0]?.scanCarrierFrequencyHz).toBe(430_000_000);
    expect(synced.zones[1]?.exportScanList).toBeUndefined();
  });
});

describe('zone member order override helpers', () => {
  it('detects when layout hint differs from library effective order', () => {
    const z = zone(ZONE_A, 'Alpha', [CHANNEL, CHANNEL_2, CHANNEL_3]);
    const zones = [z];
    expect(isZoneMemberOrderOverridden(z, zones, undefined)).toBe(false);
    expect(isZoneMemberOrderOverridden(z, zones, [])).toBe(false);
    expect(isZoneMemberOrderOverridden(z, zones, [CHANNEL, CHANNEL_2, CHANNEL_3])).toBe(false);
    expect(isZoneMemberOrderOverridden(z, zones, [CHANNEL_3, CHANNEL, CHANNEL_2])).toBe(true);
  });

  it('resets layout channelIds to library effective order', () => {
    const z = zone(ZONE_A, 'Alpha', [CHANNEL, CHANNEL_2, CHANNEL_3]);
    const zones = [z];
    let layout = seedZoneGroupingFromLibrary(emptyLibrary(zones));
    layout = updateZoneChannelIds(layout, ZONE_A, [CHANNEL_3, CHANNEL, CHANNEL_2]);
    expect(isZoneMemberOrderOverridden(z, zones, layout.zones[0]?.channelIds)).toBe(true);

    layout = resetZoneMemberOrderToLibrary(layout, z, zones);
    expect(layout.zones[0]?.channelIds).toEqual([CHANNEL, CHANNEL_2, CHANNEL_3]);
    expect(isZoneMemberOrderOverridden(z, zones, layout.zones[0]?.channelIds)).toBe(false);
  });
});
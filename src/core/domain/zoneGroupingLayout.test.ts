import { describe, expect, it } from 'vitest';
import type { Zone } from '@core/models/library.ts';
import { initialRevision } from '@core/models/revision.ts';
import {
  seedZoneGroupingFromLibrary,
  syncZoneGroupingWithLibrary,
} from './zoneGroupingLayout.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const ZONE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ZONE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CHANNEL = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function zone(id: string, name: string): Zone {
  return {
    id,
    projectId: PROJECT_ID,
    revision: initialRevision(),
    updatedAt: '2026-07-09T10:00:00.000Z',
    name,
    members: [{ kind: 'channel', channelId: CHANNEL }],
    comment: '',
  };
}

describe('syncZoneGroupingWithLibrary', () => {
  it('seeds from library when layout is undefined', () => {
    const library = { zones: [zone(ZONE_A, 'Alpha'), zone(ZONE_B, 'Beta')] };
    const synced = syncZoneGroupingWithLibrary(undefined, library);
    expect(synced.zones.map((entry) => entry.id)).toEqual([ZONE_A, ZONE_B]);
  });

  it('adds new library zones and drops removed ones', () => {
    const library = { zones: [zone(ZONE_A, 'Alpha'), zone(ZONE_B, 'Beta')] };
    const layout = seedZoneGroupingFromLibrary({ zones: [zone(ZONE_A, 'Alpha')] });
    layout.zones[0]!.exportScanList = true;
    layout.zones[0]!.scanCarrierFrequencyHz = 430_000_000;

    const synced = syncZoneGroupingWithLibrary(layout, library);
    expect(synced.zones.map((entry) => entry.id)).toEqual([ZONE_A, ZONE_B]);
    expect(synced.zones[0]?.exportScanList).toBe(true);
    expect(synced.zones[0]?.scanCarrierFrequencyHz).toBe(430_000_000);
    expect(synced.zones[1]?.exportScanList).toBeUndefined();
  });
});

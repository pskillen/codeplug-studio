import { describe, expect, it } from 'vitest';
import type { Zone } from '@core/models/library.ts';
import { initialRevision } from '@core/models/revision.ts';
import { scanMemberIds, zoneScanMemberCounts } from './members.ts';
import { buildZoneBehaviourContext } from '@core/import-export/zoneBehaviourDefaults/index.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const CHANNEL_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CHANNEL_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PARENT_ID = '44444444-4444-4444-8444-444444444444';
const CHILD_ID = '55555555-5555-4555-8555-555555555555';

function zone(id: string, members: Zone['members'], name = 'Test'): Zone {
  return {
    id,
    projectId: PROJECT_ID,
    revision: initialRevision(),
    updatedAt: '2026-07-09T10:00:00.000Z',
    name,
    members,
    comment: '',
  };
}

describe('zoneDerivedScanLists members', () => {
  it('honours member skip override on scanMemberIds', () => {
    const z = zone(PARENT_ID, [
      { kind: 'channel', channelId: CHANNEL_A },
      { kind: 'channel', channelId: CHANNEL_B, includeInScanList: 'skip' },
    ]);
    expect(scanMemberIds(z, [z])).toEqual([CHANNEL_A]);
    expect(zoneScanMemberCounts(z, [z])).toEqual({ included: 1, total: 2 });
  });

  it('honours projection on exported zone independently of nested child skips', () => {
    const child = zone(
      CHILD_ID,
      [{ kind: 'channel', channelId: CHANNEL_A, includeInScanList: 'skip' }],
      'Child',
    );
    const parent = zone(
      PARENT_ID,
      [
        { kind: 'zone', zoneId: CHILD_ID },
        { kind: 'channel', channelId: CHANNEL_B },
      ],
      'Parent',
    );
    const zones = [parent, child];

    // Child member skip still applies when resolving parent without projection.
    expect(scanMemberIds(parent, zones)).toEqual([CHANNEL_B]);

    // Parent projection can force-include CHANNEL_A for parent export only.
    expect(
      scanMemberIds(parent, zones, {
        layoutEntry: {
          id: PARENT_ID,
          name: 'Parent',
          channelIds: [],
          scanMemberInclusion: { [CHANNEL_A]: 'include' },
        },
      }),
    ).toEqual([CHANNEL_A, CHANNEL_B]);

    // Child export without that projection still skips CHANNEL_A.
    expect(
      scanMemberIds(child, zones, {
        layoutEntry: {
          id: CHILD_ID,
          name: 'Child',
          channelIds: [],
        },
      }),
    ).toEqual([]);
  });

  it('honours build-wide defaultIncludeInZoneDerivedScanList', () => {
    const z = zone(PARENT_ID, [
      { kind: 'channel', channelId: CHANNEL_A },
      { kind: 'channel', channelId: CHANNEL_B },
    ]);
    expect(
      scanMemberIds(z, [z], {
        context: buildZoneBehaviourContext(undefined, {
          defaultIncludeInZoneDerivedScanList: false,
        }),
      }),
    ).toEqual([]);
  });
});

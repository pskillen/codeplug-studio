import { describe, expect, it } from 'vitest';
import type { Zone } from '@core/models/library.ts';
import { initialRevision } from '@core/models/revision.ts';
import { scanMemberIds, zoneScanMemberCounts } from './members.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const CHANNEL_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CHANNEL_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function zone(members: Zone['members']): Zone {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    projectId: PROJECT_ID,
    revision: initialRevision(),
    updatedAt: '2026-07-09T10:00:00.000Z',
    name: 'Test',
    members,
    comment: '',
  };
}

describe('zoneDerivedScanLists members', () => {
  it('honours includeInScanList on scanMemberIds', () => {
    const z = zone([
      { kind: 'channel', channelId: CHANNEL_A },
      { kind: 'channel', channelId: CHANNEL_B, includeInScanList: false },
    ]);
    expect(scanMemberIds(z, [z])).toEqual([CHANNEL_A]);
    expect(zoneScanMemberCounts(z, [z])).toEqual({ included: 1, total: 2 });
  });
});

import { describe, expect, it } from 'vitest';
import type { Zone } from '@core/models/library.ts';
import { zoneMemberChannelIds } from './zoneMembers.ts';

function zone(members: Zone['members']): Zone {
  return {
    id: 'zone-1',
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test zone',
    comment: '',
    members,
  };
}

describe('zoneMemberChannelIds', () => {
  it('reads channelId from ZoneMemberEntry', () => {
    expect(zoneMemberChannelIds(zone([{ channelId: 'ch-a' }, { channelId: 'ch-b' }]))).toEqual([
      'ch-a',
      'ch-b',
    ]);
  });

  it('normalises legacy EntityRef members on read', () => {
    expect(
      zoneMemberChannelIds(
        zone([{ kind: 'channel', id: 'ch-legacy' } as unknown as Zone['members'][number]]),
      ),
    ).toEqual(['ch-legacy']);
  });
});

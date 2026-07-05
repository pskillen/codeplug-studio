import { describe, expect, it } from 'vitest';
import { zoneMembersFromSelectedIds } from './zoneMembers.ts';

describe('zoneMembersFromSelectedIds', () => {
  it('preserves picker order in member entries', () => {
    expect(zoneMembersFromSelectedIds(['c3', 'c1', 'c2'])).toEqual([
      { kind: 'channel', channelId: 'c3' },
      { kind: 'channel', channelId: 'c1' },
      { kind: 'channel', channelId: 'c2' },
    ]);
  });
});

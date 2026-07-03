import { describe, expect, it } from 'vitest';
import { zoneMembersFromSelectedIds } from './zoneMembers.ts';

describe('zoneMembersFromSelectedIds', () => {
  it('preserves picker order in member entries', () => {
    expect(zoneMembersFromSelectedIds(['c3', 'c1', 'c2'])).toEqual([
      { channelId: 'c3' },
      { channelId: 'c1' },
      { channelId: 'c2' },
    ]);
  });
});

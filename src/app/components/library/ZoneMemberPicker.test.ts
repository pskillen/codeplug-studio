import { describe, expect, it } from 'vitest';
import { zoneMembersFromSelectedIds } from './ZoneMemberPicker.tsx';

describe('zoneMembersFromSelectedIds', () => {
  it('preserves picker order in member refs', () => {
    expect(zoneMembersFromSelectedIds(['c3', 'c1', 'c2'])).toEqual([
      { kind: 'channel', id: 'c3' },
      { kind: 'channel', id: 'c1' },
      { kind: 'channel', id: 'c2' },
    ]);
  });
});

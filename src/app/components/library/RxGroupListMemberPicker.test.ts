import { describe, expect, it } from 'vitest';
import type { RxGroupListMember } from '@core/models/library.ts';
import { reorderRxGroupListMembers, rxGroupListMemberKey } from '@core/domain/membershipOrder.ts';
import { reorderRxGroupListMembersByKeys } from './RxGroupListMemberPicker.tsx';

function member(kind: 'talkGroup' | 'digitalContact', id: string): RxGroupListMember {
  return { ref: { kind, id } };
}

describe('reorderRxGroupListMembers (RGL picker)', () => {
  const members = [
    member('talkGroup', 'a'),
    member('talkGroup', 'b'),
    member('digitalContact', 'c'),
  ];

  it('moves selected members up as a block', () => {
    const next = reorderRxGroupListMembers(members, new Set(['talkGroup:b']), 'up');
    expect(next.map((m) => m.ref.id)).toEqual(['b', 'a', 'c']);
  });

  it('moves selected members down as a block', () => {
    const next = reorderRxGroupListMembers(members, new Set(['talkGroup:a']), 'down');
    expect(next.map((m) => m.ref.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('reorderRxGroupListMembersByKeys', () => {
  it('preserves timeSlotOverride when remapping ordered keys', () => {
    const members: RxGroupListMember[] = [
      { ref: { kind: 'talkGroup', id: 'tg-1' }, timeSlotOverride: 2 },
      { ref: { kind: 'digitalContact', id: 'dc-1' } },
      { ref: { kind: 'talkGroup', id: 'tg-2' }, timeSlotOverride: 1 },
    ];
    const keys = members.map(rxGroupListMemberKey);
    const reordered = reorderRxGroupListMembersByKeys(members, [keys[2]!, keys[0]!, keys[1]!]);
    expect(reordered.map(rxGroupListMemberKey)).toEqual([
      'talkGroup:tg-2',
      'talkGroup:tg-1',
      'digitalContact:dc-1',
    ]);
    expect(reordered[0]?.timeSlotOverride).toBe(1);
    expect(reordered[1]?.timeSlotOverride).toBe(2);
    expect(reordered[2]?.timeSlotOverride).toBeUndefined();
  });

  it('returns original members when key length mismatches', () => {
    const members = [member('talkGroup', 'a'), member('talkGroup', 'b')];
    expect(reorderRxGroupListMembersByKeys(members, ['talkGroup:a'])).toBe(members);
  });
});

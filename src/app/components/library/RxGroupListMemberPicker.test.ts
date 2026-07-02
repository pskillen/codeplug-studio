import { describe, expect, it } from 'vitest';
import type { RxGroupListMember } from '@core/models/library.ts';
import { moveSelectedMemberBlock } from './RxGroupListMemberPicker.tsx';

function member(kind: 'talkGroup' | 'digitalContact', id: string): RxGroupListMember {
  return { ref: { kind, id } };
}

describe('moveSelectedMemberBlock', () => {
  const members = [member('talkGroup', 'a'), member('talkGroup', 'b'), member('digitalContact', 'c')];

  it('moves selected members up as a block', () => {
    const next = moveSelectedMemberBlock(members, new Set(['talkGroup:b']), 'up');
    expect(next.map((m) => m.ref.id)).toEqual(['b', 'a', 'c']);
  });

  it('moves selected members down as a block', () => {
    const next = moveSelectedMemberBlock(members, new Set(['talkGroup:a']), 'down');
    expect(next.map((m) => m.ref.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('RxGroupListMember save shape', () => {
  it('preserves timeSlotOverride on untouched members', () => {
    const members: RxGroupListMember[] = [
      { ref: { kind: 'talkGroup', id: 'tg-1' }, timeSlotOverride: 2 },
      { ref: { kind: 'digitalContact', id: 'dc-1' } },
    ];
    const reordered = moveSelectedMemberBlock(members, new Set(['digitalContact:dc-1']), 'up');
    expect(reordered[0]?.ref.id).toBe('dc-1');
    expect(reordered[1]?.timeSlotOverride).toBe(2);
  });
});

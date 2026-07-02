import { describe, expect, it } from 'vitest';
import { emptyLibrary, newRxGroupList, newTalkGroup } from '@core/domain/factories.ts';
import {
  diffRxGroupListMembers,
  rxGroupListDiffHasChanges,
  rxGroupListsEquivalent,
} from './rxGroupListDiff.ts';
import type { ResolvedBrandMeisterTalkGroup } from './brandmeisterTalkGroups.ts';

const remote: ResolvedBrandMeisterTalkGroup[] = [
  { digitalId: 23559, name: 'Scotland West', slot: 1 },
  { digitalId: 2355, name: 'Scotland', slot: 2 },
];

describe('diffRxGroupListMembers', () => {
  it('detects added members when local list is null', () => {
    const rows = diffRxGroupListMembers(null, remote, emptyLibrary());
    expect(rows.every((r) => r.change === 'added')).toBe(true);
    expect(rxGroupListDiffHasChanges(rows)).toBe(true);
  });

  it('detects removed and slot changes', () => {
    const library = emptyLibrary();
    const tg1 = newTalkGroup('p', 'Scotland West', 23559);
    const tg2 = newTalkGroup('p', 'Scotland', 2355);
    library.talkGroups.push(tg1, tg2);
    const list = {
      ...newRxGroupList('p', 'GB7AC — BrandMeister'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg1.id }, timeSlotOverride: 2 },
        { ref: { kind: 'talkGroup' as const, id: tg2.id }, timeSlotOverride: 1 },
      ],
    };

    const rows = diffRxGroupListMembers(list, remote, library);
    expect(rxGroupListDiffHasChanges(rows)).toBe(true);
    expect(rows.some((r) => r.change === 'slot_changed' || r.change === 'removed')).toBe(true);
  });

  it('reports equivalent lists as unchanged', () => {
    const library = emptyLibrary();
    const tg1 = newTalkGroup('p', 'Scotland West', 23559);
    const tg2 = newTalkGroup('p', 'Scotland', 2355);
    library.talkGroups.push(tg1, tg2);
    const list = {
      ...newRxGroupList('p', 'GB7AC — BrandMeister'),
      members: [
        { ref: { kind: 'talkGroup' as const, id: tg1.id }, timeSlotOverride: 1 },
        { ref: { kind: 'talkGroup' as const, id: tg2.id }, timeSlotOverride: 2 },
      ],
    };

    expect(rxGroupListsEquivalent(list, remote, library)).toBe(true);
  });
});

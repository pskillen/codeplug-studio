import type { DMRTimeSlot } from '@core/models/libraryTypes.ts';
import type { Library, RxGroupList } from '@core/models/library.ts';
import type { ResolvedBrandMeisterTalkGroup } from './brandmeisterTalkGroups.ts';

export type RxGroupListMemberChange = 'added' | 'removed' | 'slot_changed' | 'unchanged';

export interface RxGroupListMemberSnapshot {
  digitalId: number;
  name: string;
  slot: DMRTimeSlot | null;
}

export interface RxGroupListDiffRow {
  digitalId: number;
  name: string;
  localSlot: DMRTimeSlot | null | undefined;
  remoteSlot: DMRTimeSlot | null | undefined;
  change: RxGroupListMemberChange;
}

function localMemberSnapshots(
  list: RxGroupList | null,
  library: Library,
): RxGroupListMemberSnapshot[] {
  if (!list) return [];
  const talkGroupsById = new Map(library.talkGroups.map((tg) => [tg.id, tg]));
  const snapshots: RxGroupListMemberSnapshot[] = [];
  for (const member of list.members) {
    if (member.ref.kind !== 'talkGroup') continue;
    const tg = talkGroupsById.get(member.ref.id);
    if (!tg) continue;
    snapshots.push({
      digitalId: tg.digitalId,
      name: tg.name,
      slot: member.timeSlotOverride ?? null,
    });
  }
  return snapshots;
}

function remoteMemberSnapshots(
  resolved: ResolvedBrandMeisterTalkGroup[],
): RxGroupListMemberSnapshot[] {
  return resolved.map((row) => ({
    digitalId: row.digitalId,
    name: row.name,
    slot: row.slot,
  }));
}

function slotsEqual(
  a: DMRTimeSlot | null | undefined,
  b: DMRTimeSlot | null | undefined,
): boolean {
  return (a ?? null) === (b ?? null);
}

/**
 * Compare a local RX group list against BrandMeister static talk groups.
 * Order-sensitive: member sequence must match for `unchanged`.
 */
export function diffRxGroupListMembers(
  localList: RxGroupList | null,
  remoteMembers: ResolvedBrandMeisterTalkGroup[],
  library: Library,
): RxGroupListDiffRow[] {
  const local = localMemberSnapshots(localList, library);
  const remote = remoteMemberSnapshots(remoteMembers);
  const rows: RxGroupListDiffRow[] = [];
  const maxLen = Math.max(local.length, remote.length);

  for (let i = 0; i < maxLen; i++) {
    const localRow = local[i];
    const remoteRow = remote[i];
    if (localRow && remoteRow) {
      if (localRow.digitalId === remoteRow.digitalId) {
        rows.push({
          digitalId: remoteRow.digitalId,
          name: remoteRow.name,
          localSlot: localRow.slot,
          remoteSlot: remoteRow.slot,
          change: slotsEqual(localRow.slot, remoteRow.slot) ? 'unchanged' : 'slot_changed',
        });
      } else {
        rows.push({
          digitalId: localRow.digitalId,
          name: localRow.name,
          localSlot: localRow.slot,
          remoteSlot: undefined,
          change: 'removed',
        });
        rows.push({
          digitalId: remoteRow.digitalId,
          name: remoteRow.name,
          localSlot: undefined,
          remoteSlot: remoteRow.slot,
          change: 'added',
        });
      }
      continue;
    }
    if (localRow) {
      rows.push({
        digitalId: localRow.digitalId,
        name: localRow.name,
        localSlot: localRow.slot,
        remoteSlot: undefined,
        change: 'removed',
      });
    }
    if (remoteRow) {
      rows.push({
        digitalId: remoteRow.digitalId,
        name: remoteRow.name,
        localSlot: undefined,
        remoteSlot: remoteRow.slot,
        change: 'added',
      });
    }
  }

  return rows;
}

export function rxGroupListDiffHasChanges(rows: RxGroupListDiffRow[]): boolean {
  return rows.some((row) => row.change !== 'unchanged');
}

export function rxGroupListsEquivalent(
  localList: RxGroupList | null,
  remoteMembers: ResolvedBrandMeisterTalkGroup[],
  library: Library,
): boolean {
  const rows = diffRxGroupListMembers(localList, remoteMembers, library);
  return !rxGroupListDiffHasChanges(rows);
}

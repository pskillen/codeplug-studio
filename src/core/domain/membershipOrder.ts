import type { RxGroupListMember } from '@core/models/library.ts';
import { reorderSelectedKeys } from '@core/domain/zoneOrder.ts';

/** Reorder scan-list channel membership by moving a selected id block. */
export function reorderScanListMembers(
  memberChannelIds: string[],
  selectedIds: ReadonlySet<string>,
  direction: 'up' | 'down',
): string[] {
  return reorderSelectedKeys(memberChannelIds, selectedIds, direction);
}

/** Key for an RX group list member (talk group or digital contact). */
export function rxGroupListMemberKey(member: RxGroupListMember): string {
  return `${member.ref.kind}:${member.ref.id}`;
}

/** Reorder RX group list members by moving a selected key block. */
export function reorderRxGroupListMembers(
  members: RxGroupListMember[],
  selectedKeys: ReadonlySet<string>,
  direction: 'up' | 'down',
): RxGroupListMember[] {
  const keys = members.map(rxGroupListMemberKey);
  const nextKeys = reorderSelectedKeys(keys, selectedKeys, direction);
  if (nextKeys.every((key, index) => key === keys[index])) return members;
  const byKey = new Map(members.map((member) => [rxGroupListMemberKey(member), member]));
  return nextKeys.map((key) => byKey.get(key)!);
}

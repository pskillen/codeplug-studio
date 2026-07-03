import type { ZoneMemberEntry } from '@core/models/library.ts';

/** Map ordered picker ids to zone member entries. */
export function zoneMembersFromSelectedIds(selectedIds: string[]): ZoneMemberEntry[] {
  return selectedIds.map((channelId) => ({ channelId }));
}

/** Read channel ids from zone members (supports legacy EntityRef on load). */
export function zoneMemberIdsFromZone(
  members: ZoneMemberEntry[] | Array<{ kind?: string; id?: string; channelId?: string }>,
): string[] {
  return members.map((member) => {
    if ('channelId' in member && member.channelId) return member.channelId;
    if ('id' in member && member.id) return member.id;
    throw new Error('Invalid zone member');
  });
}

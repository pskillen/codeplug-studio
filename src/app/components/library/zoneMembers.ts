import type { ZoneMemberEntry } from '@core/models/library.ts';

/** Map ordered picker ids to zone member entries. */
export function zoneMembersFromSelectedIds(selectedIds: string[]): ZoneMemberEntry[] {
  return selectedIds.map((channelId) => ({ kind: 'channel' as const, channelId }));
}

/** Read channel ids from zone members (supports legacy shapes on load). */
export function zoneMemberIdsFromZone(
  members: ZoneMemberEntry[] | Array<{ kind?: string; id?: string; channelId?: string }>,
): string[] {
  return members
    .map((member) => {
      if ('kind' in member && member.kind === 'zone') return null;
      if ('channelId' in member && member.channelId) return member.channelId;
      if ('id' in member && member.id) return member.id;
      if ('kind' in member && member.kind === 'channel' && 'channelId' in member) {
        return member.channelId;
      }
      throw new Error('Invalid zone member');
    })
    .filter((id): id is string => id != null);
}

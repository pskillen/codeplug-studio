import type { Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { normalizeZoneMemberEntry } from '@core/domain/zoneMembers.ts';

export type ZonePickerMemberKey = `channel:${string}` | `zone:${string}`;

export function memberKeyFromEntry(entry: ZoneMemberEntry): ZonePickerMemberKey {
  const normalized = normalizeZoneMemberEntry(entry);
  return normalized.kind === 'channel'
    ? `channel:${normalized.channelId}`
    : `zone:${normalized.zoneId}`;
}

export function entryFromMemberKey(key: ZonePickerMemberKey): ZoneMemberEntry {
  if (key.startsWith('channel:')) {
    return { kind: 'channel', channelId: key.slice('channel:'.length) };
  }
  return { kind: 'zone', zoneId: key.slice('zone:'.length) };
}

export function memberKeysFromMembers(members: ZoneMemberEntry[]): ZonePickerMemberKey[] {
  return members.map((member) => memberKeyFromEntry(member));
}

export function membersFromMemberKeys(keys: ZonePickerMemberKey[]): ZoneMemberEntry[] {
  return keys.map((key) => entryFromMemberKey(key));
}

/** Reorder existing members to match `nextKeys`, preserving per-member fields. */
export function reorderMembersByKeys(
  members: ZoneMemberEntry[],
  nextKeys: ZonePickerMemberKey[],
): ZoneMemberEntry[] {
  const byKey = new Map(members.map((member) => [memberKeyFromEntry(member), member]));
  const next: ZoneMemberEntry[] = [];
  for (const key of nextKeys) {
    const member = byKey.get(key);
    if (member) next.push(member);
  }
  return next;
}

/** Map ordered picker channel ids to zone member entries. */
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

export function normalizeZoneMembers(
  members: ZoneMemberEntry[] | Array<{ kind?: string; id?: string; channelId?: string }>,
): ZoneMemberEntry[] {
  return members.map((member) => normalizeZoneMemberEntry(member));
}

export function zoneDisplayName(zones: Zone[], zoneId: string): string {
  return zones.find((zone) => zone.id === zoneId)?.name ?? zoneId;
}

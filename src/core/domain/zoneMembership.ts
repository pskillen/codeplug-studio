import type { Channel, Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { normalizeZoneMemberEntry } from './zoneMembers.ts';
import { resolveEffectiveZoneChannelIds } from './zoneHierarchy.ts';

export type ZoneMembershipLibrarySlice = Pick<Library, 'channels' | 'zones'>;

/** True when the channel appears in any zone membership (nested flatten included). */
export function channelInAnyZoneMembership(
  channelId: string,
  library: Pick<Library, 'zones'>,
): boolean {
  for (const zone of library.zones) {
    if (resolveEffectiveZoneChannelIds(zone, library.zones).includes(channelId)) {
      return true;
    }
  }
  return false;
}

/** Channel ids not referenced by any zone (effective membership). */
export function unzonedChannelIds(library: ZoneMembershipLibrarySlice): string[] {
  return library.channels
    .filter((channel) => !channelInAnyZoneMembership(channel.id, library))
    .map((channel) => channel.id);
}

export function channelsNotInAnyZone(library: ZoneMembershipLibrarySlice): Channel[] {
  const unzoned = new Set(unzonedChannelIds(library));
  return library.channels.filter((channel) => unzoned.has(channel.id));
}

function existingChannelIds(members: ZoneMemberEntry[]): Set<string> {
  const ids = new Set<string>();
  for (const raw of members) {
    const member = normalizeZoneMemberEntry(raw);
    if (member.kind === 'channel') ids.add(member.channelId);
  }
  return ids;
}

function existingZoneMemberIds(members: ZoneMemberEntry[]): Set<string> {
  const ids = new Set<string>();
  for (const raw of members) {
    const member = normalizeZoneMemberEntry(raw);
    if (member.kind === 'zone') ids.add(member.zoneId);
  }
  return ids;
}

/** Append channel members in order; skips ids already present. */
export function addChannelsToZoneMembers(
  members: ZoneMemberEntry[],
  channelIds: readonly string[],
): ZoneMemberEntry[] {
  const seen = existingChannelIds(members);
  const additions: ZoneMemberEntry[] = [];
  for (const channelId of channelIds) {
    if (seen.has(channelId)) continue;
    seen.add(channelId);
    additions.push({ kind: 'channel', channelId });
  }
  return additions.length === 0 ? members : [...members, ...additions];
}

/** Append nested zone members in order; skips ids already present. */
export function addZonesToZoneMembers(
  members: ZoneMemberEntry[],
  zoneIds: readonly string[],
): ZoneMemberEntry[] {
  const seen = existingZoneMemberIds(members);
  const additions: ZoneMemberEntry[] = [];
  for (const zoneId of zoneIds) {
    if (seen.has(zoneId)) continue;
    seen.add(zoneId);
    additions.push({ kind: 'zone', zoneId });
  }
  return additions.length === 0 ? members : [...members, ...additions];
}

/** Remove direct channel members matching any of the given ids. */
export function removeChannelsFromZoneMembers(
  members: ZoneMemberEntry[],
  channelIds: readonly string[],
): ZoneMemberEntry[] {
  const remove = new Set(channelIds);
  return members.filter((raw) => {
    const member = normalizeZoneMemberEntry(raw);
    return member.kind !== 'channel' || !remove.has(member.channelId);
  });
}

/** Remove direct nested zone members matching any of the given ids. */
export function removeZonesFromZoneMembers(
  members: ZoneMemberEntry[],
  zoneIds: readonly string[],
): ZoneMemberEntry[] {
  const remove = new Set(zoneIds);
  return members.filter((raw) => {
    const member = normalizeZoneMemberEntry(raw);
    return member.kind !== 'zone' || !remove.has(member.zoneId);
  });
}

function memberSelectionKey(raw: ZoneMemberEntry): string {
  const member = normalizeZoneMemberEntry(raw);
  return member.kind === 'channel' ? `channel:${member.channelId}` : `zone:${member.zoneId}`;
}

/** Move selected member block up or down; preserves relative order within the selection. */
export function reorderZoneMembers(
  members: ZoneMemberEntry[],
  selectedKeys: ReadonlySet<string>,
  direction: 'up' | 'down',
): ZoneMemberEntry[] {
  const keys = members.map((member) => memberSelectionKey(member));
  const nextKeys =
    direction === 'up' ? moveKeyBlockUp(keys, selectedKeys) : moveKeyBlockDown(keys, selectedKeys);
  if (nextKeys === keys) return members;
  const byKey = new Map(members.map((member) => [memberSelectionKey(member), member]));
  return nextKeys.map((key) => byKey.get(key)!);
}

function moveKeyBlockUp(keys: string[], selected: ReadonlySet<string>): string[] {
  const next = [...keys];
  const indices = next
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => selected.has(key))
    .map(({ index }) => index);

  for (const index of indices.sort((a, b) => a - b)) {
    if (index === 0) continue;
    const above = index - 1;
    if (selected.has(next[above]!)) continue;
    [next[above], next[index]] = [next[index]!, next[above]!];
  }
  return next;
}

function moveKeyBlockDown(keys: string[], selected: ReadonlySet<string>): string[] {
  const next = [...keys];
  const indices = next
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => selected.has(key))
    .map(({ index }) => index);

  for (const index of indices.sort((a, b) => b - a)) {
    if (index >= next.length - 1) continue;
    const below = index + 1;
    if (selected.has(next[below]!)) continue;
    [next[below], next[index]] = [next[index]!, next[below]!];
  }
  return next;
}

/** Ordered direct channel members for a zone row. */
export function directZoneChannelMembersInOrder(zone: Zone): Channel['id'][] {
  return zone.members
    .map((raw) => normalizeZoneMemberEntry(raw))
    .filter(
      (member): member is Extract<ZoneMemberEntry, { kind: 'channel' }> =>
        member.kind === 'channel',
    )
    .map((member) => member.channelId);
}

import type { Zone, ZoneMemberEntry } from '@core/models/library.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';

/** Legacy v4 shape — `{ kind: 'channel', id }`. */
function isLegacyZoneMember(member: unknown): member is EntityRef {
  return (
    typeof member === 'object' &&
    member != null &&
    'kind' in member &&
    (member as EntityRef).kind === 'channel' &&
    'id' in member
  );
}

export function normalizeZoneMemberEntry(raw: unknown): ZoneMemberEntry {
  if (typeof raw === 'object' && raw != null && 'channelId' in raw) {
    const record = raw as ZoneMemberEntry;
    return {
      channelId: String(record.channelId),
      ...(record.includeInScanList === false ? { includeInScanList: false } : {}),
    };
  }
  if (isLegacyZoneMember(raw)) {
    return { channelId: raw.id };
  }
  throw new Error('Invalid zone member entry');
}

export function zoneMemberChannelIds(zone: Zone): string[] {
  return zone.members.map((member) => member.channelId);
}

export function zoneMemberEntityRefs(zone: Zone): EntityRef[] {
  return zone.members.map((member) => ({ kind: 'channel', id: member.channelId }));
}

export function memberIncludedInScanList(member: ZoneMemberEntry): boolean {
  return member.includeInScanList !== false;
}

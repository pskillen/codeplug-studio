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

function isLegacyChannelMember(
  raw: unknown,
): raw is { channelId: string; includeInScanList?: boolean } {
  return typeof raw === 'object' && raw != null && 'channelId' in raw && !('kind' in raw);
}

export function normalizeZoneMemberEntry(raw: unknown): ZoneMemberEntry {
  if (isLegacyZoneMember(raw)) {
    return { kind: 'channel', channelId: raw.id };
  }
  if (typeof raw === 'object' && raw != null && 'kind' in raw) {
    const record = raw as ZoneMemberEntry;
    if (record.kind === 'zone') {
      return { kind: 'zone', zoneId: String(record.zoneId) };
    }
    if (record.kind === 'channel') {
      return {
        kind: 'channel',
        channelId: String(record.channelId),
        ...(record.includeInScanList === false ? { includeInScanList: false } : {}),
      };
    }
  }
  if (isLegacyChannelMember(raw)) {
    return {
      kind: 'channel',
      channelId: String(raw.channelId),
      ...(raw.includeInScanList === false ? { includeInScanList: false } : {}),
    };
  }
  throw new Error('Invalid zone member entry');
}

/** Direct channel refs on a zone row — does not recurse into child zones. */
export function directZoneMemberChannelIds(zone: Zone): string[] {
  return zone.members
    .map((member) => normalizeZoneMemberEntry(member))
    .filter(
      (member): member is Extract<ZoneMemberEntry, { kind: 'channel' }> =>
        member.kind === 'channel',
    )
    .map((member) => member.channelId);
}

/** @deprecated Use directZoneMemberChannelIds — name kept for incremental migration. */
export const zoneMemberChannelIds = directZoneMemberChannelIds;

export function directZoneMemberZoneIds(zone: Zone): string[] {
  return zone.members
    .map((member) => normalizeZoneMemberEntry(member))
    .filter(
      (member): member is Extract<ZoneMemberEntry, { kind: 'zone' }> => member.kind === 'zone',
    )
    .map((member) => member.zoneId);
}

export function zoneMemberEntityRefs(zone: Zone): EntityRef[] {
  return directZoneMemberChannelIds(zone).map((id) => ({ kind: 'channel', id }));
}

export function memberIncludedInScanList(member: ZoneMemberEntry): boolean {
  if (member.kind !== 'channel') return true;
  return member.includeInScanList !== false;
}

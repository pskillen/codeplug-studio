import type { Zone, ZoneMemberEntry } from '@core/models/library.ts';
import type { IncludeInZoneDerivedScanListOverride } from '@core/models/zoneBehaviourDefaults.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';
import { normalizeIncludeInScanListOverride } from '@core/import-export/zoneBehaviourDefaults/resolve.ts';

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
): raw is { channelId: string; includeInScanList?: unknown } {
  return typeof raw === 'object' && raw != null && 'channelId' in raw && !('kind' in raw);
}

function sparseIncludeInScanList(
  value: IncludeInZoneDerivedScanListOverride,
): { includeInScanList: IncludeInZoneDerivedScanListOverride } | Record<string, never> {
  if (value === 'default') return {};
  return { includeInScanList: value };
}

export function normalizeZoneMemberEntry(raw: unknown): ZoneMemberEntry {
  if (isLegacyZoneMember(raw)) {
    return { kind: 'channel', channelId: raw.id };
  }
  if (typeof raw === 'object' && raw != null && 'kind' in raw) {
    const record = raw as ZoneMemberEntry & { includeInScanList?: unknown };
    if (record.kind === 'zone') {
      return { kind: 'zone', zoneId: String(record.zoneId) };
    }
    if (record.kind === 'channel') {
      const override = normalizeIncludeInScanListOverride(record.includeInScanList);
      return {
        kind: 'channel',
        channelId: String(record.channelId),
        ...sparseIncludeInScanList(override),
      };
    }
  }
  if (isLegacyChannelMember(raw)) {
    const override = normalizeIncludeInScanListOverride(raw.includeInScanList);
    return {
      kind: 'channel',
      channelId: String(raw.channelId),
      ...sparseIncludeInScanList(override),
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

/**
 * Legacy helper: true unless member override is explicitly `skip`.
 * Prefer `effectiveIncludeInZoneDerivedScanList` when cascade context is available.
 */
export function memberIncludedInScanList(member: ZoneMemberEntry): boolean {
  if (member.kind !== 'channel') return true;
  return (member.includeInScanList ?? 'default') !== 'skip';
}

function pluralCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Human-readable direct member counts for list UI — channels and/or nested zones. */
export function formatZoneDirectMemberSummary(zone: Zone): string {
  const channelCount = directZoneMemberChannelIds(zone).length;
  const zoneCount = directZoneMemberZoneIds(zone).length;
  const parts: string[] = [];
  if (channelCount > 0) parts.push(pluralCount(channelCount, 'channel', 'channels'));
  if (zoneCount > 0) parts.push(pluralCount(zoneCount, 'zone', 'zones'));
  if (parts.length === 0) return 'No members';
  return parts.join(' + ');
}

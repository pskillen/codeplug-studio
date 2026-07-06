import type { Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { normalizeZoneMemberEntry } from './zoneMembers.ts';

function zoneMap(zones: Zone[]): Map<string, Zone> {
  return new Map(zones.map((zone) => [zone.id, zone]));
}

/**
 * Flatten a zone's membership to channel ids in member order.
 * Child zones are expanded depth-first; duplicate channel ids are skipped (first wins).
 */
export function resolveEffectiveZoneChannelIds(zone: Zone, zones: Zone[]): string[] {
  const zonesById = zoneMap(zones);
  const result: string[] = [];
  const seen = new Set<string>();

  function walk(current: Zone): void {
    for (const raw of current.members) {
      const member = normalizeZoneMemberEntry(raw);
      if (member.kind === 'channel') {
        if (seen.has(member.channelId)) continue;
        seen.add(member.channelId);
        result.push(member.channelId);
        continue;
      }
      const child = zonesById.get(member.zoneId);
      if (child) walk(child);
    }
  }

  walk(zone);
  return result;
}

function membersForZone(
  zoneId: string,
  proposedMembers: ZoneMemberEntry[] | null,
  zonesById: Map<string, Zone>,
): ZoneMemberEntry[] {
  if (proposedMembers != null) {
    return proposedMembers.map((member) => normalizeZoneMemberEntry(member));
  }
  const zone = zonesById.get(zoneId);
  return zone?.members.map((member) => normalizeZoneMemberEntry(member)) ?? [];
}

/** True when following zone→zone members from rootId would revisit a zone on the path. */
export function zoneMembershipHasCycle(
  rootZoneId: string,
  proposedMembers: ZoneMemberEntry[],
  zones: Zone[],
): boolean {
  const zonesById = zoneMap(zones);

  function visit(zoneId: string, path: Set<string>): boolean {
    if (path.has(zoneId)) return true;
    const nextPath = new Set(path);
    nextPath.add(zoneId);
    const members = membersForZone(
      zoneId,
      zoneId === rootZoneId ? proposedMembers : null,
      zonesById,
    );
    for (const member of members) {
      if (member.kind === 'zone' && visit(member.zoneId, nextPath)) {
        return true;
      }
    }
    return false;
  }

  return visit(rootZoneId, new Set());
}

/** Zone ids that must not be offered as members when editing zoneId (self + descendants). */
export function zoneIdsExcludedFromMembership(
  zoneId: string,
  zones: Zone[],
  proposedRootMembers?: ZoneMemberEntry[],
): Set<string> {
  const zonesById = zoneMap(zones);
  const excluded = new Set<string>([zoneId]);

  function walk(currentId: string): void {
    const zone = zonesById.get(currentId);
    if (!zone) return;
    const members =
      currentId === zoneId && proposedRootMembers != null
        ? proposedRootMembers.map((member) => normalizeZoneMemberEntry(member))
        : zone.members.map((member) => normalizeZoneMemberEntry(member));
    for (const member of members) {
      if (member.kind === 'zone' && !excluded.has(member.zoneId)) {
        excluded.add(member.zoneId);
        walk(member.zoneId);
      }
    }
  }

  walk(zoneId);
  return excluded;
}

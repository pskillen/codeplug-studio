import type { Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { normalizeZoneMemberEntry } from './zoneMembers.ts';

function zoneMap(zones: Zone[]): Map<string, Zone> {
  return new Map(zones.map((zone) => [zone.id, zone]));
}

export interface ZoneFlattenResult {
  channelIds: string[];
  cycleWarnings: string[];
}

export interface ZoneFlattenOptions {
  /** When set, only channel members passing this predicate are included. */
  includeChannel?: (member: Extract<ZoneMemberEntry, { kind: 'channel' }>) => boolean;
  /** Called for each channel id included in the flatten result (after dedup). */
  onChannel?: (
    channelId: string,
    ownerZoneId: string,
    member: Extract<ZoneMemberEntry, { kind: 'channel' }>,
  ) => void;
}

function cycleWarningMessage(
  parentZone: Zone,
  childZoneId: string,
  zonesById: Map<string, Zone>,
): string {
  const child = zonesById.get(childZoneId);
  const childName = child?.name ?? childZoneId;
  return `Zone "${parentZone.name}" membership contains a cycle (skipped nested zone "${childName}")`;
}

/**
 * Flatten a zone's membership to channel ids in member order.
 * Child zones are expanded depth-first; duplicate channel ids are skipped (first wins).
 * Zone→zone cycles on the current path are skipped with a warning (partial flatten).
 */
export function flattenZoneMembership(
  zone: Zone,
  zones: Zone[],
  options?: ZoneFlattenOptions,
): ZoneFlattenResult {
  const zonesById = zoneMap(zones);
  const channelIds: string[] = [];
  const cycleWarnings: string[] = [];
  const seenChannels = new Set<string>();

  function walk(current: Zone, pathZoneIds: Set<string>): void {
    for (const raw of current.members) {
      const member = normalizeZoneMemberEntry(raw);
      if (member.kind === 'channel') {
        if (options?.includeChannel && !options.includeChannel(member)) continue;
        if (seenChannels.has(member.channelId)) continue;
        seenChannels.add(member.channelId);
        channelIds.push(member.channelId);
        options?.onChannel?.(member.channelId, current.id, member);
        continue;
      }
      const childId = member.zoneId;
      if (pathZoneIds.has(childId)) {
        cycleWarnings.push(cycleWarningMessage(current, childId, zonesById));
        continue;
      }
      const child = zonesById.get(childId);
      if (!child) continue;
      const nextPath = new Set(pathZoneIds);
      nextPath.add(current.id);
      walk(child, nextPath);
    }
  }

  walk(zone, new Set());
  return { channelIds, cycleWarnings };
}

/**
 * Flatten a zone's membership to channel ids in member order.
 * Child zones are expanded depth-first; duplicate channel ids are skipped (first wins).
 */
export function resolveEffectiveZoneChannelIds(zone: Zone, zones: Zone[]): string[] {
  return flattenZoneMembership(zone, zones).channelIds;
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

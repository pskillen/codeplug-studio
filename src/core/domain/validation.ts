import type { EntityRef, Library, ZoneMemberEntry } from '../models/library.ts';
import { normalizeZoneMemberEntry } from './zoneMembers.ts';
import { zoneMembershipHasCycle } from './zoneHierarchy.ts';

export function assertNonEmptyName(name: string, field: string): void {
  if (!name.trim()) {
    throw new Error(`${field} must not be empty`);
  }
}

export function libraryEntityIds(library: Library): {
  channelIds: Set<string>;
  talkGroupIds: Set<string>;
  digitalContactIds: Set<string>;
  analogContactIds: Set<string>;
  rxGroupListIds: Set<string>;
  scanListIds: Set<string>;
  zoneIds: Set<string>;
} {
  return {
    channelIds: new Set(library.channels.map((c) => c.id)),
    talkGroupIds: new Set(library.talkGroups.map((t) => t.id)),
    digitalContactIds: new Set(library.digitalContacts.map((c) => c.id)),
    analogContactIds: new Set(library.analogContacts.map((c) => c.id)),
    rxGroupListIds: new Set(library.rxGroupLists.map((r) => r.id)),
    scanListIds: new Set(library.scanLists.map((s) => s.id)),
    zoneIds: new Set(library.zones.map((z) => z.id)),
  };
}

export function validateEntityRef(ref: EntityRef, library: Library): void {
  const ids = libraryEntityIds(library);
  if (ref.kind === 'channel' && !ids.channelIds.has(ref.id)) {
    throw new Error(`Channel ref not found in library: ${ref.id}`);
  }
  if (ref.kind === 'talkGroup' && !ids.talkGroupIds.has(ref.id)) {
    throw new Error(`Talk group ref not found in library: ${ref.id}`);
  }
  if (ref.kind === 'digitalContact' && !ids.digitalContactIds.has(ref.id)) {
    throw new Error(`Digital contact ref not found in library: ${ref.id}`);
  }
  if (ref.kind === 'analogContact' && !ids.analogContactIds.has(ref.id)) {
    throw new Error(`Analog contact ref not found in library: ${ref.id}`);
  }
}

export function validateRxGroupListId(rxGroupListId: string, library: Library): void {
  const ids = libraryEntityIds(library);
  if (!ids.rxGroupListIds.has(rxGroupListId)) {
    throw new Error(`RX group list not found in library: ${rxGroupListId}`);
  }
}

export function validateScanListMembers(memberChannelIds: string[], library: Library): void {
  const ids = libraryEntityIds(library);
  for (const channelId of memberChannelIds) {
    if (!ids.channelIds.has(channelId)) {
      throw new Error(`Scan list member channel not found in library: ${channelId}`);
    }
  }
}

export function validateScanListId(scanListId: string, library: Library): void {
  const ids = libraryEntityIds(library);
  if (!ids.scanListIds.has(scanListId)) {
    throw new Error(`Scan list not found in library: ${scanListId}`);
  }
}

export function validateZoneMembership(
  zoneId: string,
  members: ZoneMemberEntry[],
  library: Library,
): void {
  const ids = libraryEntityIds(library);
  if (!ids.zoneIds.has(zoneId)) {
    throw new Error(`Zone not found in library: ${zoneId}`);
  }

  const normalized = members.map((member) => normalizeZoneMemberEntry(member));

  for (const member of normalized) {
    if (member.kind === 'channel') {
      if (!ids.channelIds.has(member.channelId)) {
        throw new Error(`Zone member channel not found in library: ${member.channelId}`);
      }
      continue;
    }
    if (member.zoneId === zoneId) {
      throw new Error('Zone cannot include itself as a member');
    }
    if (!ids.zoneIds.has(member.zoneId)) {
      throw new Error(`Zone member zone not found in library: ${member.zoneId}`);
    }
  }

  if (zoneMembershipHasCycle(zoneId, normalized, library.zones)) {
    throw new Error('Zone membership would create a cycle');
  }
}

export function validateZoneMembers(
  zoneId: string,
  members: ZoneMemberEntry[],
  library: Library,
): void {
  validateZoneMembership(zoneId, members, library);
}

/** @deprecated Use validateZoneMembers — accepts legacy EntityRef[] during migration. */
export function validateZoneMemberRefs(
  zoneId: string,
  members: EntityRef[],
  library: Library,
): void {
  const ids = libraryEntityIds(library);
  if (!ids.zoneIds.has(zoneId)) {
    throw new Error(`Zone not found in library: ${zoneId}`);
  }
  for (const ref of members) {
    if (ref.kind !== 'channel') {
      throw new Error(`Zone members must be channel refs; got ${ref.kind}`);
    }
    validateEntityRef(ref, library);
  }
}

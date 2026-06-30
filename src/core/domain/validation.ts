import type { EntityRef, Library } from '../models/library.ts';

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
  zoneIds: Set<string>;
} {
  return {
    channelIds: new Set(library.channels.map((c) => c.id)),
    talkGroupIds: new Set(library.talkGroups.map((t) => t.id)),
    digitalContactIds: new Set(library.digitalContacts.map((c) => c.id)),
    analogContactIds: new Set(library.analogContacts.map((c) => c.id)),
    rxGroupListIds: new Set(library.rxGroupLists.map((r) => r.id)),
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

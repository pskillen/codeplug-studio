import type { EntityRef, Library } from '../models/library.ts';

export function assertNonEmptyName(name: string, field: string): void {
  if (!name.trim()) {
    throw new Error(`${field} must not be empty`);
  }
}

export function libraryEntityIds(library: Library): {
  talkGroupIds: Set<string>;
  contactIds: Set<string>;
  rxGroupListIds: Set<string>;
} {
  return {
    talkGroupIds: new Set(library.talkGroups.map((t) => t.id)),
    contactIds: new Set(library.contacts.map((c) => c.id)),
    rxGroupListIds: new Set(library.rxGroupLists.map((r) => r.id)),
  };
}

export function validateEntityRef(ref: EntityRef, library: Library): void {
  const ids = libraryEntityIds(library);
  if (ref.kind === 'talkGroup' && !ids.talkGroupIds.has(ref.id)) {
    throw new Error(`Talk group ref not found in library: ${ref.id}`);
  }
  if (ref.kind === 'contact' && !ids.contactIds.has(ref.id)) {
    throw new Error(`Contact ref not found in library: ${ref.id}`);
  }
}

export function validateRxGroupListId(rxGroupListId: string, library: Library): void {
  const ids = libraryEntityIds(library);
  if (!ids.rxGroupListIds.has(rxGroupListId)) {
    throw new Error(`RX group list not found in library: ${rxGroupListId}`);
  }
}

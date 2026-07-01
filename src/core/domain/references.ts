import type { ChannelModeProfileDMR, EntityRef, Library } from '../models/library.ts';
import type { EntityRefKind } from '../models/libraryTypes.ts';

/** A reference held by one library entity pointing at a target entity. */
export interface EntityReference {
  fromKind: 'channel' | 'zone' | 'rxGroupList';
  fromId: string;
  fromName: string;
  /** Human-readable description of how the target is referenced. */
  relationship: string;
}

/** Target of a reference scan: a library entity addressed by kind + UUID id. */
export interface ReferenceTarget {
  kind: EntityRefKind | 'rxGroupList';
  id: string;
}

function refMatches(ref: EntityRef, target: ReferenceTarget): boolean {
  return ref.kind === target.kind && ref.id === target.id;
}

function dmrProfiles(channel: Library['channels'][number]): ChannelModeProfileDMR[] {
  return channel.modeProfiles.filter((p): p is ChannelModeProfileDMR => p.mode === 'dmr');
}

/**
 * Find every library entity that references the target entity via a UUID `id`
 * foreign key. Used to block or cascade deletes deliberately. Vendor-neutral:
 * only internal `id` relationships are scanned, never name strings.
 */
export function findReferencesTo(library: Library, target: ReferenceTarget): EntityReference[] {
  const refs: EntityReference[] = [];

  // Zones reference channels via members.
  for (const zone of library.zones) {
    if (zone.members.some((m) => refMatches(m, target))) {
      refs.push({
        fromKind: 'zone',
        fromId: zone.id,
        fromName: zone.name,
        relationship: 'zone member',
      });
    }
  }

  // RX group lists reference talk groups / contacts via members.
  for (const list of library.rxGroupLists) {
    if (list.members.some((m) => refMatches(m.ref, target))) {
      refs.push({
        fromKind: 'rxGroupList',
        fromId: list.id,
        fromName: list.name,
        relationship: 'RX group list member',
      });
    }
  }

  // Channels reference contacts and RX group lists via their DMR profile.
  for (const channel of library.channels) {
    for (const profile of dmrProfiles(channel)) {
      const refsContact = profile.contactRef !== null && refMatches(profile.contactRef, target);
      const refsRxList = target.kind === 'rxGroupList' && profile.rxGroupListId === target.id;
      if (refsContact || refsRxList) {
        refs.push({
          fromKind: 'channel',
          fromId: channel.id,
          fromName: channel.name,
          relationship: refsContact ? 'channel DMR contact' : 'channel RX group list',
        });
        break;
      }
    }
  }

  return refs;
}

export function isReferenced(library: Library, target: ReferenceTarget): boolean {
  return findReferencesTo(library, target).length > 0;
}

/** A foreign key pointing at an entity id that no longer exists in the library. */
export interface DanglingReference {
  fromKind: 'channel' | 'zone' | 'rxGroupList';
  fromId: string;
  fromName: string;
  targetKind: ReferenceTarget['kind'];
  targetId: string;
  relationship: string;
}

/**
 * Find references whose target id is missing from the library — integrity
 * warnings surfaced in the summary view. Only UUID `id` relationships are checked.
 */
export function findDanglingReferences(library: Library): DanglingReference[] {
  const channelIds = new Set(library.channels.map((c) => c.id));
  const talkGroupIds = new Set(library.talkGroups.map((t) => t.id));
  const digitalContactIds = new Set(library.digitalContacts.map((c) => c.id));
  const analogContactIds = new Set(library.analogContacts.map((c) => c.id));
  const rxGroupListIds = new Set(library.rxGroupLists.map((r) => r.id));

  const hasTarget = (target: ReferenceTarget): boolean => {
    switch (target.kind) {
      case 'channel':
        return channelIds.has(target.id);
      case 'talkGroup':
        return talkGroupIds.has(target.id);
      case 'digitalContact':
        return digitalContactIds.has(target.id);
      case 'analogContact':
        return analogContactIds.has(target.id);
      case 'rxGroupList':
        return rxGroupListIds.has(target.id);
    }
  };

  const dangling: DanglingReference[] = [];

  for (const zone of library.zones) {
    for (const member of zone.members) {
      const target: ReferenceTarget = { kind: member.kind, id: member.id };
      if (!hasTarget(target)) {
        dangling.push({
          fromKind: 'zone',
          fromId: zone.id,
          fromName: zone.name,
          targetKind: target.kind,
          targetId: target.id,
          relationship: 'zone member',
        });
      }
    }
  }

  for (const list of library.rxGroupLists) {
    for (const member of list.members) {
      const target: ReferenceTarget = { kind: member.ref.kind, id: member.ref.id };
      if (!hasTarget(target)) {
        dangling.push({
          fromKind: 'rxGroupList',
          fromId: list.id,
          fromName: list.name,
          targetKind: target.kind,
          targetId: target.id,
          relationship: 'RX group list member',
        });
      }
    }
  }

  for (const channel of library.channels) {
    for (const profile of dmrProfiles(channel)) {
      if (profile.contactRef && !hasTarget(profile.contactRef)) {
        dangling.push({
          fromKind: 'channel',
          fromId: channel.id,
          fromName: channel.name,
          targetKind: profile.contactRef.kind,
          targetId: profile.contactRef.id,
          relationship: 'channel DMR contact',
        });
      }
      if (profile.rxGroupListId && !rxGroupListIds.has(profile.rxGroupListId)) {
        dangling.push({
          fromKind: 'channel',
          fromId: channel.id,
          fromName: channel.name,
          targetKind: 'rxGroupList',
          targetId: profile.rxGroupListId,
          relationship: 'channel RX group list',
        });
      }
    }
  }

  return dangling;
}

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

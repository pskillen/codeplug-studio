import type { ChannelModeProfileDMR, EntityRef, Library } from '../models/library.ts';
import type { EntityRefKind } from '../models/libraryTypes.ts';
import { directZoneMemberZoneIds, normalizeZoneMemberEntry } from './zoneMembers.ts';
import { resolveEffectiveZoneChannelIds } from './zoneHierarchy.ts';

/** A reference held by one library entity pointing at a target entity. */
export interface EntityReference {
  fromKind:
    | 'channel'
    | 'zone'
    | 'rxGroupList'
    | 'scanList'
    | 'aprsConfiguration'
    | 'formatBuild';
  fromId: string;
  fromName: string;
  /** Human-readable description of how the target is referenced. */
  relationship: string;
}

/** Target of a reference scan: a library entity addressed by kind + UUID id. */
export interface ReferenceTarget {
  kind: EntityRefKind | 'rxGroupList' | 'scanList' | 'zone' | 'aprsConfiguration';
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

  // Zones reference channels via members (effective flattened set).
  for (const zone of library.zones) {
    if (
      target.kind === 'channel' &&
      resolveEffectiveZoneChannelIds(zone, library.zones).includes(target.id)
    ) {
      refs.push({
        fromKind: 'zone',
        fromId: zone.id,
        fromName: zone.name,
        relationship: 'zone member',
      });
    }
    if (target.kind === 'zone' && directZoneMemberZoneIds(zone).includes(target.id)) {
      refs.push({
        fromKind: 'zone',
        fromId: zone.id,
        fromName: zone.name,
        relationship: 'nested zone member',
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

  // Scan lists reference channels via ordered members.
  for (const scanList of library.scanLists) {
    if (target.kind === 'channel' && scanList.memberChannelIds.includes(target.id)) {
      refs.push({
        fromKind: 'scanList',
        fromId: scanList.id,
        fromName: scanList.name,
        relationship: 'scan list member',
      });
    }
  }

  // Channels reference contacts, RX group lists, talk groups, scan lists, and APRS report channels.
  for (const channel of library.channels) {
    if (target.kind === 'scanList' && channel.scanListId === target.id) {
      refs.push({
        fromKind: 'channel',
        fromId: channel.id,
        fromName: channel.name,
        relationship: 'channel scan list',
      });
    }
    if (
      target.kind === 'channel' &&
      channel.aprs?.reportChannelRef?.kind === 'channel' &&
      channel.aprs.reportChannelRef.id === target.id
    ) {
      refs.push({
        fromKind: 'channel',
        fromId: channel.id,
        fromName: channel.name,
        relationship: 'channel APRS report channel',
      });
    }
    for (const profile of channel.modeProfiles) {
      if (profile.mode === 'dmr') {
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
        continue;
      }
      if (profile.mode === 'nxdn' || profile.mode === 'tetra') {
        if (profile.talkGroupRef !== null && refMatches(profile.talkGroupRef, target)) {
          refs.push({
            fromKind: 'channel',
            fromId: channel.id,
            fromName: channel.name,
            relationship: `channel ${profile.mode.toUpperCase()} talk group`,
          });
          break;
        }
      }
    }
  }

  // APRS configurations reference channels via slot channelRef.
  for (const config of library.aprsConfigurations) {
    for (const slot of config.channelSlots) {
      if (slot.channelRef && refMatches(slot.channelRef, target)) {
        refs.push({
          fromKind: 'aprsConfiguration',
          fromId: config.id,
          fromName: config.name,
          relationship: 'APRS slot channel',
        });
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
  fromKind: 'channel' | 'zone' | 'rxGroupList' | 'scanList' | 'aprsConfiguration';
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

  const zoneIds = new Set(library.zones.map((z) => z.id));

  const scanListIds = new Set(library.scanLists.map((s) => s.id));

  const hasTarget = (target: ReferenceTarget): boolean => {
    switch (target.kind) {
      case 'channel':
        return channelIds.has(target.id);
      case 'zone':
        return zoneIds.has(target.id);
      case 'talkGroup':
        return talkGroupIds.has(target.id);
      case 'digitalContact':
        return digitalContactIds.has(target.id);
      case 'analogContact':
        return analogContactIds.has(target.id);
      case 'rxGroupList':
        return rxGroupListIds.has(target.id);
      case 'scanList':
        return scanListIds.has(target.id);
      case 'aprsConfiguration':
        return library.aprsConfigurations.some((c) => c.id === target.id);
    }
  };

  const dangling: DanglingReference[] = [];

  for (const zone of library.zones) {
    for (const raw of zone.members) {
      const member = normalizeZoneMemberEntry(raw);
      if (member.kind === 'channel') {
        const target: ReferenceTarget = { kind: 'channel', id: member.channelId };
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
        continue;
      }
      const target: ReferenceTarget = { kind: 'zone', id: member.zoneId };
      if (!hasTarget(target)) {
        dangling.push({
          fromKind: 'zone',
          fromId: zone.id,
          fromName: zone.name,
          targetKind: target.kind,
          targetId: target.id,
          relationship: 'nested zone member',
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

  for (const list of library.scanLists) {
    for (const channelId of list.memberChannelIds) {
      const target: ReferenceTarget = { kind: 'channel', id: channelId };
      if (!hasTarget(target)) {
        dangling.push({
          fromKind: 'scanList',
          fromId: list.id,
          fromName: list.name,
          targetKind: target.kind,
          targetId: target.id,
          relationship: 'scan list member',
        });
      }
    }
  }

  for (const channel of library.channels) {
    if (channel.scanListId && !scanListIds.has(channel.scanListId)) {
      dangling.push({
        fromKind: 'channel',
        fromId: channel.id,
        fromName: channel.name,
        targetKind: 'scanList',
        targetId: channel.scanListId,
        relationship: 'channel scan list',
      });
    }
    if (channel.aprs?.reportChannelRef && !hasTarget(channel.aprs.reportChannelRef)) {
      dangling.push({
        fromKind: 'channel',
        fromId: channel.id,
        fromName: channel.name,
        targetKind: channel.aprs.reportChannelRef.kind,
        targetId: channel.aprs.reportChannelRef.id,
        relationship: 'channel APRS report channel',
      });
    }
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

  for (const config of library.aprsConfigurations) {
    for (const slot of config.channelSlots) {
      if (slot.channelRef && !hasTarget(slot.channelRef)) {
        dangling.push({
          fromKind: 'aprsConfiguration',
          fromId: config.id,
          fromName: config.name,
          targetKind: slot.channelRef.kind,
          targetId: slot.channelRef.id,
          relationship: 'APRS slot channel',
        });
      }
    }
  }

  return dangling;
}

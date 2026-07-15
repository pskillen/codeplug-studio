import type { Library } from '@core/models/library.ts';
import { directZoneMemberZoneIds } from '@core/domain/zoneMembers.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import { findReferencesTo, type ReferenceTarget } from '@core/domain/references.ts';

export function referenceTargetKey(target: ReferenceTarget): string {
  return `${target.kind}:${target.id}`;
}

export function referenceCount(library: Library, target: ReferenceTarget): number {
  return findReferencesTo(library, target).length;
}

export function referenceCountFromIndex(
  index: Map<string, number>,
  target: ReferenceTarget,
): number {
  return index.get(referenceTargetKey(target)) ?? 0;
}

/**
 * Single-pass reference counts for list-table cells. Keys match
 * {@link referenceTargetKey} (`kind:id`). Read-side only — same semantics as
 * {@link findReferencesTo} length per target.
 */
export function buildReferenceCountIndex(library: Library): Map<string, number> {
  const counts = new Map<string, number>();

  const bump = (target: ReferenceTarget) => {
    const key = referenceTargetKey(target);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  };

  for (const zone of library.zones) {
    for (const channelId of resolveEffectiveZoneChannelIds(zone, library.zones)) {
      bump({ kind: 'channel', id: channelId });
    }
    for (const nestedZoneId of directZoneMemberZoneIds(zone)) {
      bump({ kind: 'zone', id: nestedZoneId });
    }
  }

  for (const list of library.rxGroupLists) {
    for (const member of list.members) {
      bump({ kind: member.ref.kind, id: member.ref.id });
    }
  }

  for (const scanList of library.scanLists) {
    for (const channelId of scanList.memberChannelIds) {
      bump({ kind: 'channel', id: channelId });
    }
  }

  for (const channel of library.channels) {
    if (channel.scanListId) {
      bump({ kind: 'scanList', id: channel.scanListId });
    }

    if (channel.aprs?.reportSlotIndex != null && library.aprsConfiguration) {
      const slot = library.aprsConfiguration.channelSlots[channel.aprs.reportSlotIndex - 1];
      if (slot?.channelRef) {
        bump(slot.channelRef);
      }
    }

    for (const profile of channel.modeProfiles) {
      if (profile.mode === 'dmr') {
        if (profile.contactRef) {
          bump(profile.contactRef);
        }
        if (profile.rxGroupListId) {
          bump({ kind: 'rxGroupList', id: profile.rxGroupListId });
        }
        continue;
      }
      if (profile.mode === 'nxdn' || profile.mode === 'tetra') {
        if (profile.talkGroupRef) {
          bump(profile.talkGroupRef);
          break;
        }
      }
    }
  }

  const aprsConfig = library.aprsConfiguration;
  if (aprsConfig) {
    for (const slot of aprsConfig.channelSlots) {
      if (slot.channelRef) {
        bump(slot.channelRef);
      }
    }
  }

  return counts;
}

export function formatReferenceCount(count: number): string {
  return count === 0 ? '—' : String(count);
}

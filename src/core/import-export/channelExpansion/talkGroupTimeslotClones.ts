import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import type { DMRTimeSlot, EntityRef } from '@core/models/libraryTypes.ts';
import { BuildCapabilityTrait, traitProfileFor } from '@core/models/traits.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { shortenWireName, uniqueWireName } from './shortenName.ts';
import { sanitiseAsciiWireString } from '../sanitiseAsciiWireString.ts';

export interface TalkGroupTimeslotClone {
  talkGroupId: string;
  digitalId: number;
  slot: DMRTimeSlot;
  wireName: string;
  baseWireName: string;
}

export interface TalkGroupTimeslotCloneIndex {
  clones: readonly TalkGroupTimeslotClone[];
  wireNameFor(talkGroupId: string, slot: DMRTimeSlot): string;
  resolveTxSlot(channelTimeslot?: DMRTimeSlot | null): DMRTimeSlot;
  resolveRxMemberSlot(memberTimeSlotOverride?: DMRTimeSlot | null): DMRTimeSlot;
}

export function profileHasTalkGroupTimeslotClones(profileId: string | undefined): boolean {
  if (!profileId) return false;
  const profile = traitProfileFor(profileId);
  return profile?.traits.includes(BuildCapabilityTrait.TalkGroupTimeslotClones) ?? false;
}

export function talkGroupSlotKey(talkGroupId: string, slot: DMRTimeSlot): string {
  return `${talkGroupId}:${slot}`;
}

/** TX contact slot: channel DMR timeslot, else TS1. */
export function resolveTalkGroupTxSlot(channelTimeslot?: DMRTimeSlot | null): DMRTimeSlot {
  return channelTimeslot === 2 ? 2 : 1;
}

/** RGL member slot: per-member override, else TS1 (list is not channel-scoped). */
export function resolveTalkGroupRxMemberSlot(
  memberTimeSlotOverride?: DMRTimeSlot | null,
): DMRTimeSlot {
  return memberTimeSlotOverride === 2 ? 2 : memberTimeSlotOverride === 1 ? 1 : 1;
}

function isDmrProfile(
  profile: { mode: string } | undefined,
): profile is ChannelModeProfileDMR {
  return profile?.mode === 'dmr';
}

/** Collect demanded TS1/TS2 slots per talk group from TX contacts and RGL members. */
export function collectTalkGroupSlotDemand(
  assembled: AssembledBuild,
): Map<string, Set<DMRTimeSlot>> {
  const demand = new Map<string, Set<DMRTimeSlot>>();

  const addSlot = (talkGroupId: string, slot: DMRTimeSlot) => {
    let set = demand.get(talkGroupId);
    if (!set) {
      set = new Set();
      demand.set(talkGroupId, set);
    }
    set.add(slot);
  };

  for (const row of assembled.channels) {
    const dmr = row.entity.modeProfiles.find(isDmrProfile);
    if (!dmr?.contactRef || dmr.contactRef.kind !== 'talkGroup') continue;
    addSlot(dmr.contactRef.id, resolveTalkGroupTxSlot(dmr.timeslot));
  }

  for (const list of assembled.rxGroupLists) {
    for (const member of list.entity.members) {
      if (member.ref.kind !== 'talkGroup') continue;
      addSlot(member.ref.id, resolveTalkGroupRxMemberSlot(member.timeSlotOverride));
    }
  }

  return demand;
}

export function timeslotCloneSuffix(slot: DMRTimeSlot): string {
  return slot === 2 ? ' TS2' : ' TS1';
}

export function composeTalkGroupCloneWireName(
  baseWireName: string,
  slot: DMRTimeSlot,
  reserved: Set<string>,
  maxNameLength?: number,
): string {
  const suffix = timeslotCloneSuffix(slot);
  const trimmedBase = baseWireName.trim();
  let candidate: string;
  if (maxNameLength == null) {
    candidate = `${trimmedBase}${suffix}`;
  } else {
    const stemMax = Math.max(1, maxNameLength - suffix.length);
    let stem = shortenWireName(trimmedBase, stemMax, {
      allowCallsignSuffixDowngrade: false,
    });
    if (stem.length > stemMax) stem = stem.slice(0, stemMax);
    candidate = `${trimmedBase.length <= stemMax ? trimmedBase : stem}${suffix}`;
    if (candidate.length > maxNameLength) {
      candidate = candidate.slice(0, maxNameLength);
    }
  }
  const wireName = sanitiseAsciiWireString(uniqueWireName(candidate, reserved));
  reserved.add(wireName);
  return wireName;
}

export interface BuildTalkGroupTimeslotCloneIndexOptions {
  maxNameLength?: number;
  reserved?: Set<string>;
}

/**
 * Build ordered contact clones for OpenGD77-style export / Write.
 * Emits only slots referenced by TX contacts or RGL members; unlinked-only TGs get TS1.
 */
export function buildTalkGroupTimeslotCloneIndex(
  assembled: AssembledBuild,
  baseWireNames: ReadonlyMap<string, string>,
  options?: BuildTalkGroupTimeslotCloneIndexOptions,
): TalkGroupTimeslotCloneIndex {
  const reserved = options?.reserved ?? new Set<string>();
  const demand = collectTalkGroupSlotDemand(assembled);
  const clones: TalkGroupTimeslotClone[] = [];
  const wireByKey = new Map<string, string>();

  for (const row of assembled.talkGroups) {
    const tgId = row.entity.id;
    const slots = demand.get(tgId) ?? new Set<DMRTimeSlot>([1]);
    const sortedSlots = [...slots].sort((a, b) => a - b) as DMRTimeSlot[];
    const baseWireName = baseWireNames.get(tgId) ?? row.wireName;

    for (const slot of sortedSlots) {
      const wireName = composeTalkGroupCloneWireName(
        baseWireName,
        slot,
        reserved,
        options?.maxNameLength,
      );
      const key = talkGroupSlotKey(tgId, slot);
      wireByKey.set(key, wireName);
      clones.push({
        talkGroupId: tgId,
        digitalId: row.entity.digitalId,
        slot,
        wireName,
        baseWireName,
      });
    }
  }

  return {
    clones,
    wireNameFor(talkGroupId: string, slot: DMRTimeSlot): string {
      return wireByKey.get(talkGroupSlotKey(talkGroupId, slot)) ?? '';
    },
    resolveTxSlot: resolveTalkGroupTxSlot,
    resolveRxMemberSlot: resolveTalkGroupRxMemberSlot,
  };
}

/** Resolve a talk-group entity ref to a clone wire name when clones are active. */
export function talkGroupCloneWireName(
  index: TalkGroupTimeslotCloneIndex,
  talkGroupId: string,
  slot: DMRTimeSlot,
  fallbackWireName: string,
): string {
  return index.wireNameFor(talkGroupId, slot) || fallbackWireName;
}

export function talkGroupCloneWireNameForRef(
  index: TalkGroupTimeslotCloneIndex,
  ref: EntityRef,
  fallbackWireName: string,
  slot: DMRTimeSlot,
): string {
  if (ref.kind !== 'talkGroup') return fallbackWireName;
  return talkGroupCloneWireName(index, ref.id, slot, fallbackWireName);
}

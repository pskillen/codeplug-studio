import { newRxGroupList, newTalkGroup } from '@core/domain/factories.ts';
import { findDmrProfile } from '@core/domain/modeProfiles.ts';
import type {
  Channel,
  ChannelModeProfileDMR,
  Library,
  RxGroupList,
  RxGroupListMember,
  TalkGroup,
} from '@core/models/library.ts';
import type { ResolvedBrandMeisterTalkGroup } from './brandmeisterTalkGroups.ts';
import { repeaterListingToChannel, type MapListingOptions } from './mapToChannel.ts';
import type { RepeaterListing } from './types.ts';

export interface BrandMeisterImportBundle {
  talkGroupsToCreate: TalkGroup[];
  talkGroupsExisting: TalkGroup[];
  rxGroupList: RxGroupList | null;
  channel: Channel;
}

function defaultRxGroupListName(callsign: string): string {
  const call = callsign.trim() || 'Repeater';
  return `${call} — BrandMeister`;
}

export function uniqueRxGroupListName(base: string, library: Library): string {
  const existing = new Set(library.rxGroupLists.map((list) => list.name));
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base} ${suffix}`)) suffix++;
  return `${base} ${suffix}`;
}

function findTalkGroupByDigitalId(library: Library, digitalId: number): TalkGroup | null {
  return library.talkGroups.find((tg) => tg.digitalId === digitalId) ?? null;
}

function withRxGroupListOnChannel(channel: Channel, rxGroupListId: string): Channel {
  const dmr = findDmrProfile(channel);
  if (dmr) {
    return {
      ...channel,
      modeProfiles: channel.modeProfiles.map((profile) =>
        profile.mode === 'dmr'
          ? ({ ...profile, rxGroupListId } satisfies ChannelModeProfileDMR)
          : profile,
      ),
    };
  }
  const dmrProfile: ChannelModeProfileDMR = {
    mode: 'dmr',
    colourCode: null,
    timeslot: null,
    dmrId: null,
    contactRef: null,
    rxGroupListId,
  };
  return { ...channel, modeProfiles: [...channel.modeProfiles, dmrProfile] };
}

function buildMembers(
  resolved: ResolvedBrandMeisterTalkGroup[],
  talkGroupIdByDigitalId: Map<number, string>,
): RxGroupListMember[] {
  const members: RxGroupListMember[] = [];
  for (const row of resolved) {
    const id = talkGroupIdByDigitalId.get(row.digitalId);
    if (!id) continue;
    members.push({
      ref: { kind: 'talkGroup', id },
      timeSlotOverride: row.slot,
    });
  }
  return members;
}

/**
 * Build library entities for a BrandMeister import: dedupe talk groups by
 * `digitalId`, create a repeater-scoped RX group list, and wire the channel DMR profile.
 */
export function buildBrandmeisterImportBundle(
  listing: RepeaterListing,
  projectId: string,
  library: Library,
  resolvedTalkGroups: ResolvedBrandMeisterTalkGroup[],
  options: MapListingOptions = {},
  rxGroupListName?: string,
): BrandMeisterImportBundle {
  const channel = repeaterListingToChannel(listing, projectId, options);

  if (resolvedTalkGroups.length === 0) {
    return {
      talkGroupsToCreate: [],
      talkGroupsExisting: [],
      rxGroupList: null,
      channel,
    };
  }

  const talkGroupsToCreate: TalkGroup[] = [];
  const talkGroupsExisting: TalkGroup[] = [];
  const talkGroupIdByDigitalId = new Map<number, string>();

  for (const row of resolvedTalkGroups) {
    const existing = findTalkGroupByDigitalId(library, row.digitalId);
    if (existing) {
      talkGroupsExisting.push(existing);
      talkGroupIdByDigitalId.set(row.digitalId, existing.id);
      continue;
    }
    const pending = talkGroupsToCreate.find((tg) => tg.digitalId === row.digitalId);
    if (pending) {
      talkGroupIdByDigitalId.set(row.digitalId, pending.id);
      continue;
    }
    const created = newTalkGroup(projectId, row.name, row.digitalId, 'dmr');
    talkGroupsToCreate.push(created);
    talkGroupIdByDigitalId.set(row.digitalId, created.id);
  }

  const baseName = rxGroupListName ?? defaultRxGroupListName(listing.callsign);
  const listName = uniqueRxGroupListName(baseName, library);
  const rxGroupList: RxGroupList = {
    ...newRxGroupList(projectId, listName),
    members: buildMembers(resolvedTalkGroups, talkGroupIdByDigitalId),
  };

  return {
    talkGroupsToCreate,
    talkGroupsExisting,
    rxGroupList,
    channel: withRxGroupListOnChannel(channel, rxGroupList.id),
  };
}

/**
 * Apply an RX group list sync to an existing channel — update or create list wiring.
 */
export function patchChannelRxGroupList(channel: Channel, rxGroupListId: string): Channel {
  return withRxGroupListOnChannel(channel, rxGroupListId);
}

export function buildRxGroupListFromResolved(
  projectId: string,
  name: string,
  resolvedTalkGroups: ResolvedBrandMeisterTalkGroup[],
  talkGroupIdByDigitalId: Map<number, string>,
  existingList?: RxGroupList,
): RxGroupList {
  const base = existingList ?? newRxGroupList(projectId, name);
  return {
    ...base,
    name: name.trim() || base.name,
    members: buildMembers(resolvedTalkGroups, talkGroupIdByDigitalId),
  };
}

export function resolveTalkGroupsForImport(
  library: Library,
  resolvedTalkGroups: ResolvedBrandMeisterTalkGroup[],
  projectId: string,
  createMissing: boolean,
): {
  talkGroupsToCreate: TalkGroup[];
  talkGroupIdByDigitalId: Map<number, string>;
} {
  const talkGroupsToCreate: TalkGroup[] = [];
  const talkGroupIdByDigitalId = new Map<number, string>();

  for (const row of resolvedTalkGroups) {
    const existing = findTalkGroupByDigitalId(library, row.digitalId);
    if (existing) {
      talkGroupIdByDigitalId.set(row.digitalId, existing.id);
      continue;
    }
    const pending = talkGroupsToCreate.find((tg) => tg.digitalId === row.digitalId);
    if (pending) {
      talkGroupIdByDigitalId.set(row.digitalId, pending.id);
      continue;
    }
    if (!createMissing) continue;
    const created = newTalkGroup(projectId, row.name, row.digitalId, 'dmr');
    talkGroupsToCreate.push(created);
    talkGroupIdByDigitalId.set(row.digitalId, created.id);
  }

  return { talkGroupsToCreate, talkGroupIdByDigitalId };
}

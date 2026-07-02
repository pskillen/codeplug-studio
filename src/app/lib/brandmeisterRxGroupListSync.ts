import type { Channel, Library, RxGroupList } from '@core/models/library.ts';
import { findReferencesTo } from '@core/domain/references.ts';
import { findDmrProfile } from '@core/domain/modeProfiles.ts';
import {
  buildRxGroupListFromResolved,
  diffRxGroupListMembers,
  patchChannelRxGroupList,
  resolveTalkGroupsForImport,
  rxGroupListDiffHasChanges,
  uniqueRxGroupListName,
  type RepeaterListing,
  type ResolvedBrandMeisterTalkGroup,
} from '@integrations/repeaters/index.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';

export type RxGroupListSyncMode = 'update' | 'create';

export interface ApplyRxGroupListSyncOptions {
  channel: Channel;
  library: Library;
  listing: RepeaterListing;
  resolvedTalkGroups: ResolvedBrandMeisterTalkGroup[];
  mode: RxGroupListSyncMode;
  createMissingTalkGroups: boolean;
  newListName: string;
  persistence: ProjectPersistence;
}

export type ApplyRxGroupListSyncResult =
  | { ok: true }
  | { ok: false; message: string };

export function defaultRxGroupListSyncName(callsign: string): string {
  const call = callsign.trim() || 'Repeater';
  return `${call} — BrandMeister`;
}

export function linkedRxGroupList(
  channel: Channel,
  library: Library,
): RxGroupList | null {
  const dmr = findDmrProfile(channel);
  if (!dmr?.rxGroupListId) return null;
  return library.rxGroupLists.find((list) => list.id === dmr.rxGroupListId) ?? null;
}

export function rxGroupListSharedByOtherChannels(
  channel: Channel,
  library: Library,
  listId: string,
): number {
  const refs = findReferencesTo(library, { kind: 'rxGroupList', id: listId });
  return refs.filter((ref) => ref.fromKind === 'channel' && ref.fromId !== channel.id).length;
}

export function canUpdateLinkedRxGroupList(
  channel: Channel,
  library: Library,
): { canUpdate: boolean; list: RxGroupList | null; sharedCount: number } {
  const list = linkedRxGroupList(channel, library);
  if (!list) {
    return { canUpdate: false, list: null, sharedCount: 0 };
  }
  const sharedCount = rxGroupListSharedByOtherChannels(channel, library, list.id);
  return { canUpdate: sharedCount === 0, list, sharedCount };
}

export function shouldOfferRxGroupListSync(
  channel: Channel,
  resolvedTalkGroups: ResolvedBrandMeisterTalkGroup[],
  library: Library,
): boolean {
  if (resolvedTalkGroups.length === 0) return false;
  if (!findDmrProfile(channel)) return false;
  const list = linkedRxGroupList(channel, library);
  if (!list) return true;
  const rows = diffRxGroupListMembers(list, resolvedTalkGroups, library);
  return rxGroupListDiffHasChanges(rows);
}

export async function applyRxGroupListSync(
  options: ApplyRxGroupListSyncOptions,
): Promise<ApplyRxGroupListSyncResult> {
  const {
    channel,
    library,
    listing,
    resolvedTalkGroups,
    mode,
    createMissingTalkGroups,
    newListName,
    persistence,
  } = options;

  const { talkGroupsToCreate, talkGroupIdByDigitalId } = resolveTalkGroupsForImport(
    library,
    resolvedTalkGroups,
    channel.projectId,
    createMissingTalkGroups,
  );

  for (const talkGroup of talkGroupsToCreate) {
    const result = await persistence.putTalkGroup(talkGroup, null);
    if (!result.ok) {
      return { ok: false, message: 'Could not save talk groups.' };
    }
    talkGroupIdByDigitalId.set(talkGroup.digitalId, talkGroup.id);
  }

  const linked = linkedRxGroupList(channel, library);
  let rxGroupListId: string;

  if (mode === 'update' && linked) {
    const updated = buildRxGroupListFromResolved(
      channel.projectId,
      linked.name,
      resolvedTalkGroups,
      talkGroupIdByDigitalId,
      linked,
    );
    const result = await persistence.putRxGroupList(updated, linked.revision);
    if (!result.ok) {
      return {
        ok: false,
        message:
          result.reason === 'revision_conflict'
            ? 'The RX group list was updated elsewhere. Reload and try again.'
            : 'Could not save RX group list.',
      };
    }
    rxGroupListId = linked.id;
  } else {
    const name = uniqueRxGroupListName(
      newListName.trim() || defaultRxGroupListSyncName(listing.callsign),
      library,
    );
    const created = buildRxGroupListFromResolved(
      channel.projectId,
      name,
      resolvedTalkGroups,
      talkGroupIdByDigitalId,
    );
    const result = await persistence.putRxGroupList(created, null);
    if (!result.ok) {
      return { ok: false, message: 'Could not save RX group list.' };
    }
    rxGroupListId = created.id;
  }

  const patched = patchChannelRxGroupList(channel, rxGroupListId);
  const channelResult = await persistence.putChannel(patched, channel.revision);
  if (!channelResult.ok) {
    return {
      ok: false,
      message:
        channelResult.reason === 'revision_conflict'
          ? 'This channel was updated elsewhere. Reload and try again.'
          : 'Could not update channel RX group list reference.',
    };
  }

  return { ok: true };
}

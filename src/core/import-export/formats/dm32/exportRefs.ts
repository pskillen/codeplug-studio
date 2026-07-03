import type { AssembledBuild } from '@core/services/assemble.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { isDmrMode } from './channelModes.ts';
import type { Dm32TalkGroupWireNameMap } from './talkGroupWire.ts';
import { memberRefWireName } from '../opengd77/exportRefs.ts';

export function dm32ContactRefWireName(
  assembled: AssembledBuild,
  contactRef: EntityRef | null,
  mode: ChannelMode,
  talkGroupWireNames: Dm32TalkGroupWireNameMap,
): string {
  if (!contactRef) return isDmrMode(mode) ? 'None' : 'None';

  if (contactRef.kind === 'talkGroup') {
    const wire = talkGroupWireNames.get(contactRef.id);
    if (wire) return wire;
  }

  return memberRefWireName(assembled, contactRef) || 'None';
}

export function dm32RxGroupListWireName(
  assembled: AssembledBuild,
  listId: string | null,
  mode: ChannelMode,
): string {
  if (!listId) return isDmrMode(mode) ? 'None' : 'None';
  const row = assembled.rxGroupLists.find((r) => r.entity.id === listId);
  return row?.wireName ?? 'None';
}

export function dm32RxGroupListMemberWireName(
  ref: EntityRef,
  assembled: AssembledBuild,
  talkGroupWireNames: Dm32TalkGroupWireNameMap,
): string {
  if (ref.kind === 'talkGroup') {
    return talkGroupWireNames.get(ref.id) ?? '';
  }
  return memberRefWireName(assembled, ref);
}

import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';
import {
  buildTalkGroupWireNameMap,
  type TalkGroupWireNameMap,
} from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import { memberRefWireName } from '../opengd77/exportRefs.ts';
import { dm32RxGroupListMemberWireName } from './exportRefs.ts';

export type Dm32TalkGroupWireNameMap = TalkGroupWireNameMap;

export function buildDm32TalkGroupWireNameMap(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings?: string[],
): Map<string, string> {
  return buildTalkGroupWireNameMap(assembled, options, warnings);
}

export function rxGroupListExportMemberNames(
  assembled: AssembledBuild,
  listId: string,
  talkGroupWireNames: Dm32TalkGroupWireNameMap,
): string[] {
  const list = assembled.rxGroupLists.find((r) => r.entity.id === listId);
  if (!list) return [];
  const names: string[] = [];
  for (const member of list.entity.members) {
    const name = dm32RxGroupListMemberWireName(member.ref, assembled, talkGroupWireNames);
    if (name) names.push(name);
  }
  return names;
}

export function zoneExportMemberNames(
  memberChannelIds: string[],
  expansionByChannelId: Map<
    string,
    Array<{ wireName: string; sourceChannelId: string }>
  >,
): string[] {
  const names: string[] = [];
  for (const channelId of memberChannelIds) {
    const expanded = expansionByChannelId.get(channelId) ?? [];
    for (const row of expanded) {
      names.push(row.wireName);
    }
  }
  return names;
}

export { memberRefWireName };

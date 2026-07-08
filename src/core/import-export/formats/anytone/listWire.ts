import type { AssembledBuild } from '@core/services/assemble.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { AnytoneExportWireContext } from './exportWireContext.ts';
import { formatAnytoneFrequencyMHz } from './wireFormat.ts';

export function channelFrequencyById(
  assembled: AssembledBuild,
): Map<string, { rx: string; tx: string }> {
  const map = new Map<string, { rx: string; tx: string }>();
  for (const row of assembled.channels) {
    map.set(row.entity.id, {
      rx: formatAnytoneFrequencyMHz(row.entity.rxFrequency),
      tx: formatAnytoneFrequencyMHz(row.entity.txFrequency),
    });
  }
  return map;
}

export function wireNameByChannelId(assembled: AssembledBuild): Map<string, string> {
  return new Map(assembled.channels.map((row) => [row.entity.id, row.wireName]));
}

export function rxGroupListMemberNames(
  assembled: AssembledBuild,
  listId: string,
  context?: Pick<AnytoneExportWireContext, 'talkGroupWireName' | 'digitalContactWireName'>,
): { names: string[]; ids: string[] } {
  const list = assembled.rxGroupLists.find((row) => row.entity.id === listId);
  if (!list) return { names: [], ids: [] };
  const names: string[] = [];
  const ids: string[] = [];
  for (const member of list.entity.members) {
    if (member.ref.kind === 'talkGroup') {
      const tg = assembled.talkGroups.find((row) => row.entity.id === member.ref.id);
      if (tg) {
        names.push(context ? context.talkGroupWireName(member.ref.id) : tg.wireName);
        ids.push(String(tg.entity.digitalId));
      }
    }
    if (member.ref.kind === 'digitalContact') {
      const contact = assembled.digitalContacts.find((row) => row.entity.id === member.ref.id);
      if (contact) {
        names.push(context ? context.digitalContactWireName(member.ref.id) : contact.wireName);
        ids.push(String(contact.entity.digitalId));
      }
    }
  }
  return { names, ids };
}

export function zoneChannelWireNames(
  _library: LibrarySlice,
  assembled: AssembledBuild,
  memberChannelIds: string[],
): string[] {
  const wireNames = wireNameByChannelId(assembled);
  return memberChannelIds.map((id) => wireNames.get(id) ?? '');
}

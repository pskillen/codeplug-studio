import type { AssembledBuild, AssembledZone } from '@core/services/assemble.ts';
import { channelWireNameById, memberRefWireName } from './exportRefs.ts';

/** Zone member channel wire names for OpenGD77 export. */
export function zoneExportMemberNames(zone: AssembledZone, assembled: AssembledBuild): string[] {
  const wireById = channelWireNameById(assembled);
  return zone.memberChannelIds
    .map((id) => wireById.get(id) ?? '')
    .filter((name) => name.length > 0);
}

/** RX group list member wire names — from assembled entity wire names. */
export function rxGroupListExportMemberNames(
  assembled: AssembledBuild,
  listId: string,
): string[] {
  const list = assembled.rxGroupLists.find((r) => r.entity.id === listId);
  if (!list) return [];
  return list.entity.members
    .map((member) => memberRefWireName(assembled, member.ref))
    .filter((name) => name.length > 0);
}

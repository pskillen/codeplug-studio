import type { AssembledBuild, AssembledZone } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { expandZoneMemberWireNames } from '@core/import-export/channelExpansion/multiMode.ts';
import { channelWireNameById, memberRefWireName } from './exportRefs.ts';

/** Zone member channel wire names for OpenGD77 export. */
export function zoneExportMemberNames(
  zone: AssembledZone,
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): string[] {
  const wireById = channelWireNameById(assembled);
  const channelById = new Map(assembled.channels.map((row) => [row.entity.id, row.entity]));
  return expandZoneMemberWireNames(
    zone.memberChannelIds,
    channelById,
    wireById,
    options?.expandModes ?? true,
    options,
    assembled.profileId,
  );
}

/** RX group list member wire names — from assembled entity wire names. */
export function rxGroupListExportMemberNames(assembled: AssembledBuild, listId: string): string[] {
  const list = assembled.rxGroupLists.find((r) => r.entity.id === listId);
  if (!list) return [];
  return list.entity.members
    .map((member) => memberRefWireName(assembled, member.ref))
    .filter((name) => name.length > 0);
}

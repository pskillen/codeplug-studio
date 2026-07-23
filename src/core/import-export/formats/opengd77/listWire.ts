import type { AssembledBuild, AssembledZone } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { expandChannelWireRows } from '@core/import-export/channelExpansion/multiMode.ts';
import { isProjectionExcluded } from '@core/domain/formatBuildOverrides.ts';
import { channelWireNameById, memberRefWireName } from './exportRefs.ts';

/** Zone member channel wire names for OpenGD77 export. */
export function zoneExportMemberNames(
  zone: AssembledZone,
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): string[] {
  const wireById = channelWireNameById(assembled);
  const channelById = new Map(assembled.channels.map((row) => [row.entity.id, row.entity]));
  const names: string[] = [];
  const reserved = new Set<string>();
  const expandModes = options?.expandModes ?? true;
  for (const channelId of zone.memberChannelIds) {
    const channel = channelById.get(channelId);
    if (!channel) continue;
    const baseWireName = wireById.get(channelId);
    const rows = expandChannelWireRows(
      channel,
      baseWireName,
      expandModes,
      options,
      assembled.profileId,
      reserved,
    );
    for (const row of rows) {
      if (isProjectionExcluded(options?.channelOverrides, row.key, channelId)) continue;
      names.push(row.wireName);
    }
  }
  return names;
}

/** RX group list member wire names — from assembled entity wire names. */
export function rxGroupListExportMemberNames(assembled: AssembledBuild, listId: string): string[] {
  const list = assembled.rxGroupLists.find((r) => r.entity.id === listId);
  if (!list) return [];
  return list.entity.members
    .map((member) => memberRefWireName(assembled, member.ref))
    .filter((name) => name.length > 0);
}

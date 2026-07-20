import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { NeonplugDm32uvRadioProfile } from './profiles.ts';
import type { NeonplugRxGroup } from './wireTypes.ts';

export interface NeonplugRxGroupsExport {
  rxGroups: NeonplugRxGroup[];
  /** Studio RX list UUID → 1-based NeonPlug `rxGroupListId`. */
  rxGroupIndexById: Map<string, number>;
}

/**
 * Serialise assembled RX group lists. `talkGroupIndices` are member talk-group
 * **DMR IDs** (NeonPlug radio format), not contacts-book indexes.
 */
export function serialiseNeonplugRxGroups(
  assembled: AssembledBuild,
  profile: NeonplugDm32uvRadioProfile,
  options: CpsExportOptions | undefined,
  warnings: string[],
): NeonplugRxGroupsExport {
  const rxGroups: NeonplugRxGroup[] = [];
  const rxGroupIndexById = new Map<string, number>();
  const reserved = new Set<string>();
  const talkGroupDigitalIdById = new Map(
    assembled.talkGroups.map((row) => [row.entity.id, row.entity.digitalId] as const),
  );

  if (assembled.rxGroupLists.length > profile.maxRxGroupLists) {
    warnings.push(
      `Build has ${assembled.rxGroupLists.length} RX group list(s); only ${profile.maxRxGroupLists} export to NeonPlug (${profile.label})`,
    );
  }

  for (const row of assembled.rxGroupLists) {
    if (rxGroups.length >= profile.maxRxGroupLists) break;

    const talkGroupIndices: number[] = [];
    for (const member of row.entity.members) {
      if (member.ref.kind !== 'talkGroup') continue;
      const dmrId = talkGroupDigitalIdById.get(member.ref.id);
      if (dmrId == null) continue;
      if (talkGroupIndices.includes(dmrId)) continue;
      talkGroupIndices.push(dmrId);
    }

    if (talkGroupIndices.length > profile.rxGroupListMembers) {
      warnings.push(
        `RX group list "${row.wireName}" truncated from ${talkGroupIndices.length} to ${profile.rxGroupListMembers} members`,
      );
      talkGroupIndices.length = profile.rxGroupListMembers;
    }

    const name = applyListWireNameLimits(
      row.wireName,
      reserved,
      options,
      profile.id,
      warnings,
      'RX group list',
      profile.rxGroupListNameLimit,
    );

    const index = rxGroups.length;
    const oneBased = index + 1;
    rxGroups.push({
      index,
      name,
      bitmask: 0,
      statusFlag: 0,
      entryFlag: 1,
      validationFlag: 0,
      talkGroupIndices,
    });
    rxGroupIndexById.set(row.entity.id, oneBased);
  }

  return { rxGroups, rxGroupIndexById };
}

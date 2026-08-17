import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import {
  libraryFromAssembledOrStub,
  overridesFromAssembledWireNames,
  resolveWireNamesFromOptions,
} from '@core/services/resolveWireNamesCore.ts';
import { pushWireNameResolutionWarning } from '@core/import-export/channelExpansion/wireNameWarning.ts';
import type { NeonplugDm32uvRadioProfile } from './profiles.ts';
import type { NeonplugRxGroup } from './wireTypes.ts';
import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';

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
  warnings: ExportWarning[],
): NeonplugRxGroupsExport {
  const rxGroups: NeonplugRxGroup[] = [];
  const rxGroupIndexById = new Map<string, number>();
  const talkGroupDigitalIdById = new Map(
    assembled.talkGroups.map((row) => [row.entity.id, row.entity.digitalId] as const),
  );

  const rxGroupListWireNames = new Map<string, string>();
  for (const resolution of resolveWireNamesFromOptions({
    library: libraryFromAssembledOrStub(assembled),
    entityKind: 'rxGroupList',
    formatId: 'neonplug',
    profileId: profile.id,
    options: { ...options, profileId: profile.id },
    overrides: overridesFromAssembledWireNames(assembled.rxGroupLists, (row) => row.entity.id),
  })) {
    rxGroupListWireNames.set(resolution.libraryEntityId, resolution.effective);
    pushWireNameResolutionWarning(warnings, {
      entityKind: 'RX group list',
      remediation: resolution.remediation,
      original: resolution.override ?? resolution.libraryName,
      exported: resolution.effective,
      limit: resolution.limit,
      profileId: profile.id,
    });
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
      pushGeneralWarning(
        warnings,
        `RX group list "${row.wireName}" truncated from ${talkGroupIndices.length} to ${profile.rxGroupListMembers} members`,
      );
      talkGroupIndices.length = profile.rxGroupListMembers;
    }

    const name = rxGroupListWireNames.get(row.entity.id) ?? row.wireName;

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

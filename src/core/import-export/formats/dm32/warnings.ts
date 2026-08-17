import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { expandDm32ZoneMemberWireNames } from './channelExpansion.ts';
import { collectDm32AprsGuideWarnings } from './aprsGuide.ts';
import { buildSerialiseContext } from './serialise.ts';
import { DEFAULT_DM32_PROFILE_ID, getDm32Profile } from './profiles.ts';
import {
  pushGeneralWarning,
  pushMemberCapWarning,
  type ExportWarning,
} from '@core/import-export/exportWarning.ts';

/** Collect export-time warnings for DM32 profile limits. */
export function collectDm32ExportWarnings(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
): ExportWarning[] {
  const profile = getDm32Profile(
    options?.profileId ?? assembled.profileId ?? DEFAULT_DM32_PROFILE_ID,
  );
  const warnings: ExportWarning[] = [];
  const ctx = buildSerialiseContext(assembled, library, options, warnings);

  if (ctx.expandedChannels.length > profile.maxChannels) {
    pushGeneralWarning(
      warnings,
      `Build has ${ctx.expandedChannels.length} channel rows; only ${profile.maxChannels} export to DM32`,
    );
  }

  for (const zone of assembled.zones) {
    const members = expandDm32ZoneMemberWireNames(zone.memberChannelIds, ctx.expansionByChannelId);
    if (members.length > profile.zoneMembers) {
      pushMemberCapWarning(warnings, {
        capKind: 'zone-expanded-cap',
        label: zone.wireName,
        count: members.length,
        cap: profile.zoneMembers,
      });
    }
  }

  if (assembled.rxGroupLists.length > profile.maxRxGroupLists) {
    pushGeneralWarning(
      warnings,
      `Build has ${assembled.rxGroupLists.length} RX group list(s); only ${profile.maxRxGroupLists} export to DM32`,
    );
  }

  for (const list of assembled.rxGroupLists) {
    if (list.entity.members.length > profile.rxGroupListMembers) {
      pushMemberCapWarning(warnings, {
        capKind: 'rx-group-list-members',
        label: list.wireName,
        count: list.entity.members.length,
        cap: profile.rxGroupListMembers,
        profileLabel: 'DM32',
      });
    }
  }

  warnings.push(...collectDm32AprsGuideWarnings(assembled));

  return warnings;
}

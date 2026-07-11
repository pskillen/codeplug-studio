import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { expandDm32ZoneMemberWireNames } from './channelExpansion.ts';
import { buildSerialiseContext } from './serialise.ts';
import { DEFAULT_DM32_PROFILE_ID, getDm32Profile } from './profiles.ts';

/** Collect export-time warnings for DM32 profile limits. */
export function collectDm32ExportWarnings(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
): string[] {
  const profile = getDm32Profile(
    options?.profileId ?? assembled.profileId ?? DEFAULT_DM32_PROFILE_ID,
  );
  const warnings: string[] = [];
  const ctx = buildSerialiseContext(assembled, library, options, warnings);

  if (ctx.expandedChannels.length > profile.maxChannels) {
    warnings.push(
      `Build has ${ctx.expandedChannels.length} channel rows; only ${profile.maxChannels} export to DM32`,
    );
  }

  for (const zone of assembled.zones) {
    const members = expandDm32ZoneMemberWireNames(zone.memberChannelIds, ctx.expansionByChannelId);
    if (members.length > profile.scanListMembers) {
      warnings.push(
        `Zone "${zone.wireName}" has ${members.length} expanded members (scan cap ${profile.scanListMembers})`,
      );
    }
  }

  for (const list of assembled.rxGroupLists) {
    if (list.entity.members.length > profile.rxGroupListMembers) {
      warnings.push(
        `RX group list "${list.wireName}" has ${list.entity.members.length} members; only ${profile.rxGroupListMembers} export to DM32`,
      );
    }
  }

  return warnings;
}

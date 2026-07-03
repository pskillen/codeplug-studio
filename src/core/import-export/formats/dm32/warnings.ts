import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  expandAllDm32ChannelsForExport,
  expandDm32ZoneMemberWireNames,
  dm32ChannelExpansionById,
} from './channelExpansion.ts';
import { DEFAULT_DM32_PROFILE_ID, getDm32Profile } from './profiles.ts';

/** Collect export-time warnings for DM32 profile limits. */
export function collectDm32ExportWarnings(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
): string[] {
  const profile = getDm32Profile(options?.profileId ?? assembled.profileId ?? DEFAULT_DM32_PROFILE_ID);
  const warnings: string[] = [];
  const maxNameLength = options?.maxNameLength ?? profile.nameLimit;
  const expanded = expandAllDm32ChannelsForExport(assembled, library, options, warnings);
  const expansionByChannelId = dm32ChannelExpansionById(expanded);

  if (expanded.length > profile.maxChannels) {
    warnings.push(
      `Build has ${expanded.length} channel rows; only ${profile.maxChannels} export to DM32`,
    );
  }

  for (const row of expanded) {
    if (row.wireName.length > maxNameLength) {
      warnings.push(
        `Channel wire name "${row.wireName}" exceeds ${maxNameLength} characters for ${profile.label}`,
      );
    }
  }

  for (const zone of assembled.zones) {
    const members = expandDm32ZoneMemberWireNames(zone.memberChannelIds, expansionByChannelId);
    if (zone.wireName.length > maxNameLength) {
      warnings.push(
        `Zone wire name "${zone.wireName}" exceeds ${maxNameLength} characters for ${profile.label}`,
      );
    }
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

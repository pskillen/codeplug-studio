import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { getAnytoneProfile } from './profiles.ts';
import {
  anytoneChannelExpansionById,
  expandAllAnytoneChannelsForExport,
} from './channelExpansion.ts';

export function collectAnytoneExportWarnings(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
): string[] {
  const warnings: string[] = [];
  const profile = getAnytoneProfile(options?.profileId ?? assembled.profileId);
  const expandedChannels = expandAllAnytoneChannelsForExport(assembled, library, options, warnings);
  const expansionByChannelId = anytoneChannelExpansionById(expandedChannels);

  const maxNameLength = options?.maxNameLength ?? profile.nameLimit;

  if (expandedChannels.length > profile.maxChannels) {
    warnings.push(
      `Channel count ${expandedChannels.length} exceeds profile cap ${profile.maxChannels}`,
    );
  }

  for (const row of expandedChannels) {
    if (row.wireName.length > maxNameLength) {
      warnings.push(
        `Channel wire name "${row.wireName}" exceeds ${maxNameLength} characters for ${profile.label}`,
      );
    }
  }

  for (const zone of assembled.zones) {
    const expandedMemberCount = zone.memberChannelIds.reduce(
      (count, channelId) => count + (expansionByChannelId.get(channelId)?.length ?? 1),
      0,
    );
    if (expandedMemberCount > profile.zoneMembers) {
      warnings.push(
        `Zone "${zone.wireName}" has ${expandedMemberCount} expanded members (cap ${profile.zoneMembers})`,
      );
    }
    if (zone.wireName.length > maxNameLength) {
      warnings.push(
        `Zone wire name "${zone.wireName}" exceeds ${maxNameLength} characters for ${profile.label}`,
      );
    }
  }

  for (const scanList of assembled.scanLists) {
    const expandedMemberCount = scanList.memberChannelIds.reduce(
      (count, channelId) => count + (expansionByChannelId.get(channelId)?.length ?? 1),
      0,
    );
    if (expandedMemberCount > profile.scanListMembers) {
      warnings.push(
        `Scan list "${scanList.wireName}" has ${expandedMemberCount} expanded members (cap ${profile.scanListMembers})`,
      );
    }
    if (scanList.wireName.length > maxNameLength) {
      warnings.push(
        `Scan list wire name "${scanList.wireName}" exceeds ${maxNameLength} characters for ${profile.label}`,
      );
    }
  }

  if (assembled.scanLists.length > profile.maxScanLists) {
    warnings.push(
      `Scan list count ${assembled.scanLists.length} exceeds profile cap ${profile.maxScanLists}`,
    );
  }

  for (const row of assembled.talkGroups) {
    if (row.wireName.length > maxNameLength) {
      warnings.push(
        `Talk group wire name "${row.wireName}" exceeds ${maxNameLength} characters for ${profile.label}`,
      );
    }
  }

  return warnings;
}

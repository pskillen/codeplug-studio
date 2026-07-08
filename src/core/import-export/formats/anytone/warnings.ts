import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { getAnytoneProfile } from './profiles.ts';

export function collectAnytoneExportWarnings(
  assembled: AssembledBuild,
  _library: LibrarySlice,
  options?: CpsExportOptions,
): string[] {
  const warnings: string[] = [];
  const profile = getAnytoneProfile(options?.profileId ?? assembled.profileId);

  if (assembled.channels.length > profile.maxChannels) {
    warnings.push(
      `Channel count ${assembled.channels.length} exceeds profile cap ${profile.maxChannels}`,
    );
  }

  for (const zone of assembled.zones) {
    if (zone.memberChannelIds.length > profile.zoneMembers) {
      warnings.push(
        `Zone "${zone.wireName}" has ${zone.memberChannelIds.length} members (cap ${profile.zoneMembers})`,
      );
    }
  }

  for (const scanList of assembled.scanLists) {
    if (scanList.memberChannelIds.length > profile.scanListMembers) {
      warnings.push(
        `Scan list "${scanList.wireName}" has ${scanList.memberChannelIds.length} members (cap ${profile.scanListMembers})`,
      );
    }
  }

  return warnings;
}

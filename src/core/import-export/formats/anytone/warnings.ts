import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { getAnytoneProfile } from './profiles.ts';
import {
  anytoneChannelExpansionById,
  expandAllAnytoneChannelsForExport,
} from './channelExpansion.ts';
import { buildAnytoneExportWireContext } from './exportWireContext.ts';
import {
  pushGeneralWarning,
  pushMemberCapWarning,
  type ExportWarning,
} from '@core/import-export/exportWarning.ts';

export function collectAnytoneExportWarnings(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
): ExportWarning[] {
  const warnings: ExportWarning[] = [];
  const profile = getAnytoneProfile(options?.profileId ?? assembled.profileId);
  const expandedChannels = expandAllAnytoneChannelsForExport(assembled, library, options, warnings);
  const expansionByChannelId = anytoneChannelExpansionById(expandedChannels);

  buildAnytoneExportWireContext(assembled, expandedChannels, options, warnings);

  if (expandedChannels.length > profile.maxChannels) {
    pushGeneralWarning(
      warnings,
      `Channel count ${expandedChannels.length} exceeds profile cap ${profile.maxChannels}`,
    );
  }

  for (const zone of assembled.zones) {
    const expandedMemberCount = zone.memberChannelIds.reduce(
      (count, channelId) => count + (expansionByChannelId.get(channelId)?.length ?? 1),
      0,
    );
    if (expandedMemberCount > profile.zoneMembers) {
      pushMemberCapWarning(warnings, {
        capKind: 'zone-expanded-cap',
        label: zone.wireName,
        count: expandedMemberCount,
        cap: profile.zoneMembers,
      });
    }
  }

  for (const scanList of assembled.scanLists) {
    const expandedMemberCount = scanList.memberChannelIds.reduce(
      (count, channelId) => count + (expansionByChannelId.get(channelId)?.length ?? 1),
      0,
    );
    if (expandedMemberCount > profile.scanListMembers) {
      pushMemberCapWarning(warnings, {
        capKind: 'scan-list-expanded-cap',
        label: scanList.wireName,
        count: expandedMemberCount,
        cap: profile.scanListMembers,
      });
    }
  }

  if (assembled.scanLists.length > profile.maxScanLists) {
    pushGeneralWarning(
      warnings,
      `Scan list count ${assembled.scanLists.length} exceeds profile cap ${profile.maxScanLists}`,
    );
  }

  return warnings;
}

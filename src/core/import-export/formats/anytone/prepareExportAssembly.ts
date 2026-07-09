import type {
  AssembledBuild,
  AssembledChannel,
  AssembledScanList,
} from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  buildAnytoneExportWireContext,
  type AnytoneExportWireContext,
} from './exportWireContext.ts';
import { deriveAnytoneZoneDerivedScanLists } from './zoneDerivedScanLists.ts';
import { getAnytoneProfile, DEFAULT_ANYTONE_PROFILE_ID } from './profiles.ts';

function patchChannelsForZoneDerivedScan(
  channels: AssembledChannel[],
  derivedScanLists: AssembledScanList[],
  context: AnytoneExportWireContext,
): AssembledChannel[] {
  const wireByChannelId = new Map<string, string>();
  for (const list of derivedScanLists) {
    const wireName = context.scanListWireName(list.scanListId);
    for (const channelId of list.memberChannelIds) {
      wireByChannelId.set(channelId, wireName);
    }
  }

  return channels.map((row) => {
    if (row.entity.scanListId) return row;
    const wireName = wireByChannelId.get(row.entity.id);
    if (!wireName) return row;
    return { ...row, scanListWireName: wireName };
  });
}

/** Merge library + zone-derived scan lists and resolve channel Scan List FK wiring. */
export function prepareAnytoneExportAssembly(
  assembled: AssembledBuild,
  library: LibrarySlice,
  options?: CpsExportOptions,
  warnings: string[] = [],
): { assembled: AssembledBuild; context: AnytoneExportWireContext } {
  const derived = deriveAnytoneZoneDerivedScanLists(assembled, library, options, warnings);
  const mergedScanLists = [...assembled.scanLists, ...derived.scanLists];

  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_ANYTONE_PROFILE_ID;
  const profile = getAnytoneProfile(profileId);
  if (mergedScanLists.length > profile.maxScanLists) {
    warnings.push(
      `Scan list count ${mergedScanLists.length} exceeds profile cap ${profile.maxScanLists}`,
    );
  }

  let exportAssembly: AssembledBuild = { ...assembled, scanLists: mergedScanLists };
  const context = buildAnytoneExportWireContext(exportAssembly, options, warnings);

  if (derived.scanLists.length > 0) {
    exportAssembly = {
      ...exportAssembly,
      channels: patchChannelsForZoneDerivedScan(
        exportAssembly.channels,
        derived.scanLists,
        context,
      ),
    };
  }

  return { assembled: exportAssembly, context };
}

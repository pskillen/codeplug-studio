import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { zoneExportMemberNames } from './listWire.ts';
import { buildOpenGd77ListWireMaps } from './exportListWire.ts';
import { withTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import { DEFAULT_OPENGD77_PROFILE_ID, getOpenGd77Profile } from './profiles.ts';

/** Collect export-time warnings for OpenGD77 profile limits. */
export function collectOpenGd77ExportWarnings(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): string[] {
  const profile = getOpenGd77Profile(
    options?.profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID,
  );
  const warnings: string[] = [];
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID;

  if (assembled.channels.length > profile.maxChannels) {
    warnings.push(
      `Build has ${assembled.channels.length} channels; only ${profile.maxChannels} export to OpenGD77`,
    );
  }

  const exportAssembled = withTalkGroupWireNameLimits(
    assembled,
    { ...options, profileId },
    warnings,
  );
  buildOpenGd77ListWireMaps(exportAssembled, { ...options, profileId }, warnings);

  for (const zone of assembled.zones) {
    const members = zoneExportMemberNames(zone, assembled);
    if (members.length > profile.zoneMembers) {
      warnings.push(
        `Zone "${zone.wireName}" has ${members.length} members; only ${profile.zoneMembers} export to OpenGD77`,
      );
    }
  }

  for (const list of assembled.rxGroupLists) {
    if (list.entity.members.length > profile.tgListMembers) {
      warnings.push(
        `RX group list "${list.wireName}" has ${list.entity.members.length} members; only ${profile.tgListMembers} export to OpenGD77`,
      );
    }
  }

  return warnings;
}

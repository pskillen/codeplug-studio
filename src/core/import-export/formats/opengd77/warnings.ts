import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { zoneExportMemberNames } from './listWire.ts';
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
  const maxNameLength = options?.maxNameLength ?? profile.nameLimit;

  if (assembled.channels.length > profile.maxChannels) {
    warnings.push(
      `Build has ${assembled.channels.length} channels; only ${profile.maxChannels} export to OpenGD77`,
    );
  }

  for (const row of assembled.channels) {
    if (row.wireName.length > maxNameLength) {
      warnings.push(
        `Channel wire name "${row.wireName}" exceeds ${maxNameLength} characters for ${profile.label}`,
      );
    }
  }

  for (const zone of assembled.zones) {
    const members = zoneExportMemberNames(zone, assembled);
    if (members.length > profile.zoneMembers) {
      warnings.push(
        `Zone "${zone.wireName}" has ${members.length} members; only ${profile.zoneMembers} export to OpenGD77`,
      );
    }
    if (zone.wireName.length > maxNameLength) {
      warnings.push(
        `Zone wire name "${zone.wireName}" exceeds ${maxNameLength} characters for ${profile.label}`,
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

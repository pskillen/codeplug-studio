import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { zoneExportMemberNames } from './listWire.ts';
import { buildOpenGd77ListWireMaps } from './exportListWire.ts';
import { withTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import { DEFAULT_OPENGD77_PROFILE_ID, getOpenGd77Profile } from './profiles.ts';
import { countOpenGd77ProjectedContactRows } from './timeslotExport.ts';

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

  if (assembled.zones.length > profile.maxZones) {
    warnings.push(
      `Build has ${assembled.zones.length} zones; only ${profile.maxZones} export to OpenGD77`,
    );
  }

  if (assembled.rxGroupLists.length > profile.maxRxGroupLists) {
    warnings.push(
      `Build has ${assembled.rxGroupLists.length} RX group lists; only ${profile.maxRxGroupLists} export to OpenGD77`,
    );
  }

  const exportAssembled = withTalkGroupWireNameLimits(
    assembled,
    { ...options, profileId },
    warnings,
  );
  buildOpenGd77ListWireMaps(exportAssembled, { ...options, profileId }, warnings);

  const projectedContacts = countOpenGd77ProjectedContactRows(exportAssembled, options, warnings);
  if (projectedContacts > profile.maxContacts) {
    warnings.push(
      `Build projects ${projectedContacts} contact row(s) (talk-group clones + private); only ${profile.maxContacts} fit OpenGD77 Contacts.csv`,
    );
  }

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

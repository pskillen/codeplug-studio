import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { zoneExportMemberNames } from './listWire.ts';
import { buildOpenGd77ListWireMaps } from './exportListWire.ts';
import { withTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import { DEFAULT_OPENGD77_PROFILE_ID, getOpenGd77Profile } from './profiles.ts';
import { countOpenGd77ProjectedContactRows } from './timeslotExport.ts';
import {
  pushGeneralWarning,
  pushMemberCapWarning,
  type ExportWarning,
} from '@core/import-export/exportWarning.ts';

/** Collect export-time warnings for OpenGD77 profile limits. */
export function collectOpenGd77ExportWarnings(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): ExportWarning[] {
  const profile = getOpenGd77Profile(
    options?.profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID,
  );
  const warnings: ExportWarning[] = [];
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_OPENGD77_PROFILE_ID;

  if (assembled.channels.length > profile.maxChannels) {
    pushGeneralWarning(
      warnings,
      `Build has ${assembled.channels.length} channels; only ${profile.maxChannels} export to OpenGD77`,
    );
  }

  if (assembled.zones.length > profile.maxZones) {
    pushGeneralWarning(
      warnings,
      `Build has ${assembled.zones.length} zones; only ${profile.maxZones} export to OpenGD77`,
    );
  }

  if (assembled.rxGroupLists.length > profile.maxRxGroupLists) {
    pushGeneralWarning(
      warnings,
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
    pushGeneralWarning(
      warnings,
      `Build projects ${projectedContacts} contact row(s) (talk-group clones + private); only ${profile.maxContacts} fit OpenGD77 Contacts.csv`,
    );
  }

  for (const zone of assembled.zones) {
    const members = zoneExportMemberNames(zone, assembled);
    if (members.length > profile.zoneMembers) {
      pushMemberCapWarning(warnings, {
        capKind: 'zone-members-export',
        label: zone.wireName,
        count: members.length,
        cap: profile.zoneMembers,
        profileLabel: 'OpenGD77',
      });
    }
  }

  for (const list of assembled.rxGroupLists) {
    if (list.entity.members.length > profile.tgListMembers) {
      pushMemberCapWarning(warnings, {
        capKind: 'rx-group-list-members',
        label: list.wireName,
        count: list.entity.members.length,
        cap: profile.tgListMembers,
        profileLabel: 'OpenGD77',
      });
    }
  }

  return warnings;
}

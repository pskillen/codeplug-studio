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

  const context = buildAnytoneExportWireContext(
    assembled,
    library,
    expandedChannels,
    options,
    warnings,
  );

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

  // DMRTalkGroups.CSV is shared: talk groups first, then contacts as private calls.
  const contactsWithId = assembled.digitalContacts.filter((c) => c.entity.digitalId > 0);
  const contactsListTotal = assembled.talkGroups.length + contactsWithId.length;
  if (contactsListTotal > profile.maxTalkGroups) {
    const left = Math.min(contactsWithId.length, contactsListTotal - profile.maxTalkGroups);
    pushGeneralWarning(
      warnings,
      `Talk groups and contacts total ${contactsListTotal}; DMRTalkGroups.CSV holds ${profile.maxTalkGroups} — ${left} contact(s) left out (talk groups go first)`,
    );
  }
  const talkGroupNames = new Set(
    assembled.talkGroups.map((tg) => context.talkGroupWireName(tg.entity.id)),
  );
  for (const contact of contactsWithId) {
    const name = context.digitalContactWireName(contact.entity.id);
    if (name && talkGroupNames.has(name)) {
      pushGeneralWarning(
        warnings,
        `Contact "${name}" has the same name as a talk group; the CPS may resolve the wrong one`,
      );
    }
  }

  return warnings;
}

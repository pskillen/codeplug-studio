import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  getNeonplugProfile,
  isNeonplugDm32uvProfile,
  DEFAULT_NEONPLUG_PROFILE_ID,
} from './profiles.ts';
import { NEONPLUG_MAX_CHANNEL_SCAN_LIST_ID } from './zoneDerivedScanLists.ts';

/** Cap / truncation warnings for NeonPlug channel + DM32UV org export. */
export function collectNeonplugExportWarnings(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): string[] {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_NEONPLUG_PROFILE_ID;
  const profile = getNeonplugProfile(profileId);
  const warnings: string[] = [];

  if (isNeonplugDm32uvProfile(profile)) {
    if (assembled.channels.length > profile.maxChannels) {
      warnings.push(
        `Build has ${assembled.channels.length} channel(s); only ${profile.maxChannels} export to NeonPlug (${profile.label})`,
      );
    }
    if (assembled.zones.length > profile.maxZones) {
      warnings.push(
        `Build has ${assembled.zones.length} zone(s); only ${profile.maxZones} export to NeonPlug (${profile.label})`,
      );
    }
    const contactTotal = assembled.talkGroups.length + assembled.digitalContacts.length;
    if (contactTotal > profile.maxContacts) {
      warnings.push(
        `Build has ${contactTotal} talk group(s)/contact(s); only ${profile.maxContacts} export to NeonPlug contacts book (${profile.label})`,
      );
    }
    if (assembled.rxGroupLists.length > profile.maxRxGroupLists) {
      warnings.push(
        `Build has ${assembled.rxGroupLists.length} RX group list(s); only ${profile.maxRxGroupLists} export to NeonPlug (${profile.label})`,
      );
    }
    const scanExportZones =
      assembled.zoneGrouping?.zones.filter((z) => z.exportScanList).length ?? 0;
    const maxScanLists = Math.min(profile.maxScanLists, NEONPLUG_MAX_CHANNEL_SCAN_LIST_ID);
    if (scanExportZones > maxScanLists) {
      warnings.push(
        `Build requests ${scanExportZones} zone-derived scan list(s); only ${maxScanLists} export to NeonPlug (channel scanListId bit-field)`,
      );
    }
  } else {
    const filled =
      assembled.channelMemorySlots?.filter((s) => s.channelId != null).length ??
      assembled.channels.length;
    if (filled > profile.maxMemorySlots) {
      warnings.push(
        `Truncated ${filled - profile.maxMemorySlots} channel(s) to fit ${profile.maxMemorySlots} memory slots for ${profile.label}.`,
      );
    }
  }

  return warnings;
}

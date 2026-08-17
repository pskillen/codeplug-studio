import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  getNeonplugProfile,
  isNeonplugDm32uvProfile,
  DEFAULT_NEONPLUG_PROFILE_ID,
} from './profiles.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';

/** Cap / truncation warnings for NeonPlug channel + DM32UV org export. */
export function collectNeonplugExportWarnings(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): ExportWarning[] {
  const profileId = options?.profileId ?? assembled.profileId ?? DEFAULT_NEONPLUG_PROFILE_ID;
  const profile = getNeonplugProfile(profileId);
  const warnings: ExportWarning[] = [];

  if (isNeonplugDm32uvProfile(profile)) {
    if (assembled.channels.length > profile.maxChannels) {
      pushGeneralWarning(
        warnings,
        `Build has ${assembled.channels.length} channel(s); only ${profile.maxChannels} export to NeonPlug (${profile.label})`,
      );
    }
    if (assembled.zones.length > profile.maxZones) {
      pushGeneralWarning(
        warnings,
        `Build has ${assembled.zones.length} zone(s); only ${profile.maxZones} export to NeonPlug (${profile.label})`,
      );
    }
    const contactTotal = assembled.talkGroups.length + assembled.digitalContacts.length;
    if (contactTotal > profile.maxContacts) {
      pushGeneralWarning(
        warnings,
        `Build has ${contactTotal} talk group(s)/contact(s); only ${profile.maxContacts} export to NeonPlug contacts book (${profile.label})`,
      );
    }
    if (assembled.rxGroupLists.length > profile.maxRxGroupLists) {
      pushGeneralWarning(
        warnings,
        `Build has ${assembled.rxGroupLists.length} RX group list(s); only ${profile.maxRxGroupLists} export to NeonPlug (${profile.label})`,
      );
    }
    const scanExportZones =
      assembled.zoneGrouping?.zones.filter((z) => z.exportScanList).length ?? 0;
    const maxScanLists = Math.min(profile.maxScanLists, DM32UV_LIMITS.CHANNEL_SCAN_LIST_ID_MAX);
    if (scanExportZones > maxScanLists) {
      pushGeneralWarning(
        warnings,
        `Build requests ${scanExportZones} zone-derived scan list(s); only ${maxScanLists} export to NeonPlug (channel scanListId bit-field)`,
      );
    }
  } else {
    const filled =
      assembled.channelMemorySlots?.filter((s) => s.channelId != null).length ??
      assembled.channels.length;
    if (filled > profile.maxMemorySlots) {
      pushGeneralWarning(
        warnings,
        `Truncated ${filled - profile.maxMemorySlots} channel(s) to fit ${profile.maxMemorySlots} memory slots for ${profile.label}.`,
      );
    }
  }

  return warnings;
}

import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import {
  getNeonplugProfile,
  isNeonplugDm32uvProfile,
  DEFAULT_NEONPLUG_PROFILE_ID,
} from './profiles.ts';

/** Cap / truncation warnings for NeonPlug channel export (zones/contacts deferred to #540). */
export function collectNeonplugExportWarnings(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): string[] {
  const profileId =
    options?.profileId ?? assembled.profileId ?? DEFAULT_NEONPLUG_PROFILE_ID;
  const profile = getNeonplugProfile(profileId);
  const warnings: string[] = [];

  if (isNeonplugDm32uvProfile(profile)) {
    if (assembled.channels.length > profile.maxChannels) {
      warnings.push(
        `Build has ${assembled.channels.length} channel(s); only ${profile.maxChannels} export to NeonPlug (${profile.label})`,
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

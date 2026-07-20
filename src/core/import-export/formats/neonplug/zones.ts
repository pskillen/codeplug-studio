import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { channelNumbersForMembers } from './exportContext.ts';
import type { NeonplugDm32uvRadioProfile } from './profiles.ts';
import type { NeonplugZone } from './wireTypes.ts';

/**
 * Project assembled zones → NeonPlug `zones[]` with channel **numbers**.
 * Membership is unique and ordered; truncated to profile `zoneMembers`.
 */
export function serialiseNeonplugZones(
  assembled: AssembledBuild,
  profile: NeonplugDm32uvRadioProfile,
  channelNumberById: Map<string, number>,
  options: CpsExportOptions | undefined,
  warnings: string[],
): NeonplugZone[] {
  const zones: NeonplugZone[] = [];
  const reserved = new Set<string>();

  if (assembled.zones.length > profile.maxZones) {
    warnings.push(
      `Build has ${assembled.zones.length} zone(s); only ${profile.maxZones} export to NeonPlug (${profile.label})`,
    );
  }

  for (const zone of assembled.zones) {
    if (zones.length >= profile.maxZones) break;

    let channels = channelNumbersForMembers(zone.memberChannelIds, channelNumberById);
    if (channels.length > profile.zoneMembers) {
      warnings.push(
        `Zone "${zone.wireName}" truncated from ${channels.length} to ${profile.zoneMembers} members`,
      );
      channels = channels.slice(0, profile.zoneMembers);
    }

    const name = applyListWireNameLimits(
      zone.wireName,
      reserved,
      options,
      profile.id,
      warnings,
      'Zone',
      profile.nameLimit,
    );

    zones.push({
      id: zone.zoneId,
      name,
      channels,
    });
  }

  return zones;
}

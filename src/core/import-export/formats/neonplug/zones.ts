import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { expandNeonplugZoneMemberNumbers } from './channelExpansion.ts';
import type { NeonplugDm32uvRadioProfile } from './profiles.ts';
import type { NeonplugZone } from './wireTypes.ts';

/**
 * Project assembled zones → NeonPlug `zones[]` with channel **numbers**.
 * Membership fans out via expanded channel numbers, then truncates to profile `zoneMembers`.
 */
export function serialiseNeonplugZones(
  assembled: AssembledBuild,
  profile: NeonplugDm32uvRadioProfile,
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>,
  options: CpsExportOptions | undefined,
  warnings: string[],
): NeonplugZone[] {
  const zones: NeonplugZone[] = [];
  const reserved = new Set<string>();

  for (const zone of assembled.zones) {
    if (zones.length >= profile.maxZones) break;

    let channels = expandNeonplugZoneMemberNumbers(zone.memberChannelIds, numbersBySourceChannelId);
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

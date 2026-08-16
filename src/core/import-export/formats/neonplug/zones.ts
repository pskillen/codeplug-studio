import type { CpsExportOptions } from '@core/import-export/types.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import {
  libraryFromAssembledOrStub,
  overridesFromAssembledWireNames,
  resolveWireNamesFromOptions,
} from '@core/services/resolveWireNamesCore.ts';
import { pushWireNameResolutionWarning } from '@core/import-export/channelExpansion/wireNameWarning.ts';
import { expandNeonplugZoneMemberNumbers } from './channelExpansion.ts';
import type { NeonplugDm32uvRadioProfile } from './profiles.ts';
import type { NeonplugZone } from './wireTypes.ts';
import { pushGeneralWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';

/**
 * Project assembled zones → NeonPlug `zones[]` with channel **numbers**.
 * Membership fans out via expanded channel numbers, then truncates to profile `zoneMembers`.
 * When a zone-derived scan carrier number is provided, it is prepended as the first member
 * (carrier kept on truncate).
 */
export function serialiseNeonplugZones(
  assembled: AssembledBuild,
  profile: NeonplugDm32uvRadioProfile,
  numbersBySourceChannelId: ReadonlyMap<string, readonly number[]>,
  options: CpsExportOptions | undefined,
  warnings: ExportWarning[],
  carrierNumberByZoneId: ReadonlyMap<string, number> = new Map(),
): NeonplugZone[] {
  const zones: NeonplugZone[] = [];
  const zoneWireNames = new Map<string, string>();
  for (const resolution of resolveWireNamesFromOptions({
    library: libraryFromAssembledOrStub(assembled),
    entityKind: 'zone',
    formatId: 'neonplug',
    profileId: profile.id,
    options: { ...options, profileId: profile.id },
    overrides: overridesFromAssembledWireNames(assembled.zones, (row) => row.zoneId),
  })) {
    zoneWireNames.set(resolution.libraryEntityId, resolution.effective);
    pushWireNameResolutionWarning(warnings, {
      entityKind: 'Zone',
      remediation: resolution.remediation,
      original: resolution.override ?? resolution.libraryName,
      exported: resolution.effective,
      limit: resolution.limit,
      profileId: profile.id,
    });
  }

  for (const zone of assembled.zones) {
    if (zones.length >= profile.maxZones) break;

    let channels = expandNeonplugZoneMemberNumbers(zone.memberChannelIds, numbersBySourceChannelId);
    const carrierNumber = carrierNumberByZoneId.get(zone.zoneId);
    if (carrierNumber != null) {
      channels = [carrierNumber, ...channels.filter((n) => n !== carrierNumber)];
    }
    if (channels.length > profile.zoneMembers) {
      pushGeneralWarning(
        warnings,
        `Zone "${zone.wireName}" truncated from ${channels.length} to ${profile.zoneMembers} members`,
      );
      channels = channels.slice(0, profile.zoneMembers);
    }

    const name = zoneWireNames.get(zone.zoneId) ?? zone.wireName;

    zones.push({
      id: zone.zoneId,
      name,
      channels,
    });
  }

  return zones;
}

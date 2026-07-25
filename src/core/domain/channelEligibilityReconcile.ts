import {
  channelEligibleForRadio,
  type ChannelEligibilityOptions,
} from '@core/domain/channelEligibility.ts';
import { isEntityExcluded } from '@core/domain/formatBuildOverrides.ts';
import {
  applyDenseChannelOrderOrSlots,
  buildUsesFlatMemoryList,
  chirpMemoryChannelIds,
  hasAnyOrderOrSlotOverride,
} from '@core/domain/exportOrderOrSlot.ts';
import {
  findZoneGroupingSection,
  isZoneMemberOrderOverridden,
  replaceZoneGroupingSection,
  updateZoneChannelIds,
} from '@core/domain/zoneGroupingLayout.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import type { BuildExportSettings, RadioBuild } from '@core/models/radioBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';

export function frequencyRangeHideToggleConfirmMessage(): string {
  return (
    'Change frequency-range filtering for this build?\n\n' +
    'Flat-memory slot order and any overridden zone or list member order may need redoing. ' +
    'When member order was customised, newly included channels are appended at the end.'
  );
}

function resolveHideFlag(settings: BuildExportSettings | undefined): boolean {
  return settings?.hideChannelsOutsideFrequencyRange !== false;
}

function eligibleChannelIds(
  build: RadioBuild,
  library: LibrarySlice,
  options: ChannelEligibilityOptions,
): Set<string> {
  return new Set(
    library.channels
      .filter(
        (channel) =>
          !isEntityExcluded(build.channelOverrides, channel.id) &&
          channelEligibleForRadio(channel, build.radioTargetId, options),
      )
      .map((channel) => channel.id),
  );
}

export interface ReconcileFrequencyHideToggleResult {
  build: RadioBuild;
  orderMayNeedRedo: boolean;
}

/**
 * Apply a frequency-range hide toggle and reconcile zone / flat-memory order hints (v1: append).
 */
export function reconcileBuildAfterFrequencyHideToggle(
  build: RadioBuild,
  library: LibrarySlice,
  nextHide: boolean,
): ReconcileFrequencyHideToggleResult {
  const previousHide = resolveHideFlag(build.exportSettings);
  if (previousHide === nextHide) {
    return { build, orderMayNeedRedo: false };
  }

  const before = eligibleChannelIds(build, library, { hideOutsideFrequencyRange: previousHide });
  const after = eligibleChannelIds(build, library, { hideOutsideFrequencyRange: nextHide });
  const newlyIncluded = [...after].filter((id) => !before.has(id));
  const membershipChanged = before.size !== after.size;

  let orderMayNeedRedo = membershipChanged;
  let nextBuild: RadioBuild = {
    ...build,
    exportSettings: {
      ...build.exportSettings,
      hideChannelsOutsideFrequencyRange: nextHide,
    },
  };

  const zoneSection = findZoneGroupingSection(nextBuild);
  if (zoneSection) {
    let section = zoneSection;
    for (const zoneEntry of section.zones) {
      const zone = library.zones.find((row) => row.id === zoneEntry.id);
      if (!zone) continue;
      const effective = resolveEffectiveZoneChannelIds(zone, library.zones);
      const effectiveEligible = effective.filter((id) => after.has(id));
      const overridden = isZoneMemberOrderOverridden(zone, library.zones, zoneEntry.channelIds);
      if (overridden && newlyIncluded.length > 0) {
        orderMayNeedRedo = true;
        const hint = zoneEntry.channelIds ?? [];
        const kept = hint.filter((id) => after.has(id));
        const appended = newlyIncluded.filter(
          (id) => effective.includes(id) && !kept.includes(id),
        );
        section = updateZoneChannelIds(section, zone.id, [...kept, ...appended]);
      } else if (!overridden) {
        section = updateZoneChannelIds(section, zone.id, effectiveEligible);
      }
    }
    nextBuild = replaceZoneGroupingSection(nextBuild, section);
  }

  if (buildUsesFlatMemoryList(nextBuild) && hasAnyOrderOrSlotOverride(nextBuild.channelOverrides)) {
    orderMayNeedRedo = true;
    if (newlyIncluded.length > 0) {
      const ordered = chirpMemoryChannelIds(nextBuild, library);
      const merged = [...ordered, ...newlyIncluded.filter((id) => !ordered.includes(id))];
      nextBuild = {
        ...nextBuild,
        channelOverrides: applyDenseChannelOrderOrSlots(nextBuild.channelOverrides, merged),
      };
    }
  }

  return { build: nextBuild, orderMayNeedRedo };
}

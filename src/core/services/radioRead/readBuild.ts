import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { isEntityExcluded, upsertOverride } from '@core/domain/formatBuildOverrides.ts';
import {
  applyDenseOrderOrSlots,
  buildUsesFlatMemoryList,
  clearAllOrderOrSlots,
} from '@core/domain/exportOrderOrSlot.ts';
import {
  findZoneGroupingSection,
  replaceZoneGroupingSection,
  syncZoneGroupingWithLibrary,
} from '@core/domain/zoneGroupingLayout.ts';
import { hasZoneScanSet, radioTargetHasTrait } from '@core/radio-targets/catalog.ts';
import { BuildCapabilityTrait } from '@core/models/traits.ts';

export interface ReadBuildZoneInput {
  zoneId: string;
  name: string;
  channelIds: readonly string[];
  scanChannelIds?: readonly string[];
}
export interface PlanReadBuildInput {
  build: RadioBuild;
  library: LibrarySlice;
  slotToChannelId: ReadonlyMap<number, string>;
  zones: readonly ReadBuildZoneInput[];
}
export interface ReadBuildSummary {
  channelSlotsPinned: number;
  zonesOrdered: number;
  scanSetsSet: number;
  channelsLeftOut: number;
  zonesLeftOut: number;
}
export function selectReadBuild(args: {
  builds: readonly RadioBuild[];
  radioTargetId: string;
  startedFromBuildId?: string | null;
}): RadioBuild | null {
  return (
    args.builds.find(
      (b) => b.id === args.startedFromBuildId && b.radioTargetId === args.radioTargetId,
    ) ??
    args.builds.find((b) => b.radioTargetId === args.radioTargetId) ??
    null
  );
}
export function planReadBuild({ build, library, slotToChannelId, zones }: PlanReadBuildInput): {
  build: RadioBuild;
  summary: ReadBuildSummary;
} {
  let channelOverrides = build.channelOverrides;
  let zoneOverrides = build.zoneOverrides;
  const summary: ReadBuildSummary = {
    channelSlotsPinned: 0,
    zonesOrdered: 0,
    scanSetsSet: 0,
    channelsLeftOut: 0,
    zonesLeftOut: 0,
  };
  let result = build;
  if (buildUsesFlatMemoryList(build)) {
    channelOverrides = clearAllOrderOrSlots(channelOverrides);
    for (const [slot, id] of slotToChannelId) {
      channelOverrides = upsertOverride(channelOverrides, id, { orderOrSlot: slot });
      summary.channelSlotsPinned++;
    }
  }
  if (radioTargetHasTrait(build.radioTargetId, BuildCapabilityTrait.ZoneGrouping) && zones.length) {
    zoneOverrides = applyDenseOrderOrSlots(
      zoneOverrides,
      zones.map((zone) => zone.zoneId),
    );
    const previous = findZoneGroupingSection(build);
    const section = syncZoneGroupingWithLibrary(previous, library);
    const byId = new Map(section.zones.map((entry) => [entry.id, entry]));
    const readIds = new Set(zones.map((zone) => zone.zoneId));
    const ordered = zones.flatMap((zone) => {
      const entry = byId.get(zone.zoneId);
      if (!entry) return [];
      let scanMemberInclusion = entry.scanMemberInclusion;
      if (zone.scanChannelIds !== undefined && hasZoneScanSet(build.radioTargetId)) {
        const scanIds = new Set(zone.scanChannelIds);
        scanMemberInclusion = Object.fromEntries(
          zone.channelIds.map((id) => [id, scanIds.has(id) ? 'include' : 'skip']),
        );
        summary.scanSetsSet++;
      }
      return [
        {
          ...entry,
          channelIds: [...zone.channelIds],
          ...(scanMemberInclusion !== undefined ? { scanMemberInclusion } : {}),
        },
      ];
    });
    const previousOrder = new Map(previous?.zones.map((entry, index) => [entry.id, index]) ?? []);
    const others = section.zones.filter((entry) => !readIds.has(entry.id));
    others.sort(
      (a, b) => (previousOrder.get(a.id) ?? Infinity) - (previousOrder.get(b.id) ?? Infinity),
    );
    result = replaceZoneGroupingSection(build, { ...section, zones: [...ordered, ...others] });
    summary.zonesOrdered = zones.length;
  }
  const readChannels = new Set(slotToChannelId.values());
  for (const channel of library.channels) {
    const excluded = !readChannels.has(channel.id);
    if (excluded && !isEntityExcluded(build.channelOverrides, channel.id))
      summary.channelsLeftOut++;
    channelOverrides = upsertOverride(channelOverrides, channel.id, { excluded });
  }
  if (radioTargetHasTrait(build.radioTargetId, BuildCapabilityTrait.ZoneGrouping) && zones.length) {
    const readZones = new Set(zones.map((z) => z.zoneId));
    for (const zone of library.zones) {
      const excluded = !readZones.has(zone.id);
      if (excluded && !isEntityExcluded(build.zoneOverrides, zone.id)) summary.zonesLeftOut++;
      zoneOverrides = upsertOverride(zoneOverrides, zone.id, { excluded });
    }
  }
  if (buildUsesFlatMemoryList(build)) {
    channelOverrides = [...channelOverrides].sort((a, b) =>
      a.libraryEntityId.localeCompare(b.libraryEntityId),
    );
  }
  return { build: { ...result, channelOverrides, zoneOverrides }, summary };
}

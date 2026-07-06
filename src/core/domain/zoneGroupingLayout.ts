import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';

export function findZoneGroupingSection(build: FormatBuild): ZoneGroupingLayout | undefined {
  return build.layout.sections.find((s): s is ZoneGroupingLayout => s.kind === 'zoneGrouping');
}

/** Seed export layout from library zone membership when build has no zone grouping section. */
export function seedZoneGroupingFromLibrary(library: LibrarySlice): ZoneGroupingLayout {
  return {
    kind: 'zoneGrouping',
    zones: library.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      // Snapshot for member order hints and DM32 flags — assemble re-derives membership from library.
      channelIds: resolveEffectiveZoneChannelIds(zone, library.zones),
    })),
  };
}

/** Apply layout channelIds as an order hint; append effective ids not present in the hint. */
export function orderChannelIdsByLayoutHint(
  effectiveIds: string[],
  layoutChannelIds: string[],
): string[] {
  if (layoutChannelIds.length === 0) return effectiveIds;
  const effectiveSet = new Set(effectiveIds);
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const id of layoutChannelIds) {
    if (!effectiveSet.has(id) || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  for (const id of effectiveIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

export function updateZoneGroupingEntry(
  section: ZoneGroupingLayout,
  zoneId: string,
  patch: Partial<ZoneGroupingZoneEntry>,
): ZoneGroupingLayout {
  return {
    ...section,
    zones: section.zones.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone)),
  };
}

export function replaceZoneGroupingSection(
  build: FormatBuild,
  section: ZoneGroupingLayout,
): FormatBuild {
  const other = build.layout.sections.filter((section) => section.kind !== 'zoneGrouping');
  return {
    ...build,
    layout: { sections: [...other, section] },
  };
}

export function updateZoneChannelIds(
  section: ZoneGroupingLayout,
  zoneId: string,
  channelIds: string[],
): ZoneGroupingLayout {
  return {
    ...section,
    zones: section.zones.map((zone) => (zone.id === zoneId ? { ...zone, channelIds } : zone)),
  };
}

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

/**
 * Ensure layout zone entries match the current library inventory.
 * Preserves export flags and channel order hints for zones that still exist.
 */
export function syncZoneGroupingWithLibrary(
  layout: ZoneGroupingLayout | undefined,
  library: LibrarySlice,
): ZoneGroupingLayout {
  const base = layout ?? seedZoneGroupingFromLibrary(library);
  const existingById = new Map(base.zones.map((entry) => [entry.id, entry]));

  return {
    kind: 'zoneGrouping',
    zones: library.zones.map((zone) => {
      const existing = existingById.get(zone.id);
      const effectiveIds = resolveEffectiveZoneChannelIds(zone, library.zones);
      const channelIds =
        existing && existing.channelIds.length > 0
          ? orderChannelIdsByLayoutHint(effectiveIds, existing.channelIds)
          : effectiveIds;

      if (!existing) {
        return {
          id: zone.id,
          name: zone.name,
          channelIds,
        };
      }

      return {
        ...existing,
        id: zone.id,
        name: zone.name,
        channelIds,
      };
    }),
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

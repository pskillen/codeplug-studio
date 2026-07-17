import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { Zone } from '@core/models/library.ts';
import type { ZoneGroupingLayout, ZoneGroupingZoneEntry } from '@core/models/traitLayout.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { resolveEffectiveZoneChannelIds } from '@core/domain/zoneHierarchy.ts';
import { sortZonesByExportOrder } from '@core/domain/zoneOrder.ts';

export function findZoneGroupingSection(build: FormatBuild): ZoneGroupingLayout | undefined {
  return build.layout.sections.find((s): s is ZoneGroupingLayout => s.kind === 'zoneGrouping');
}

/** Seed export layout from library zone membership when build has no zone grouping section. */
export function seedZoneGroupingFromLibrary(library: LibrarySlice): ZoneGroupingLayout {
  const zones = sortZonesByExportOrder(library.zones);
  return {
    kind: 'zoneGrouping',
    zones: zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      // Snapshot for member order hints and DM32 flags — assemble re-derives membership from library.
      channelIds: resolveEffectiveZoneChannelIds(zone, library.zones),
    })),
  };
}

/**
 * Ensure layout zone entries match the current library inventory (library zone order).
 * Preserves export flags and channel order hints for zones that still exist.
 */
export function syncZoneGroupingWithLibrary(
  layout: ZoneGroupingLayout | undefined,
  library: LibrarySlice,
): ZoneGroupingLayout {
  const base = layout ?? seedZoneGroupingFromLibrary(library);
  const existingById = new Map(base.zones.map((entry) => [entry.id, entry]));
  const zones = sortZonesByExportOrder(library.zones);

  return {
    kind: 'zoneGrouping',
    zones: zones.map((zone) => {
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

function channelIdSequencesEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

/**
 * True when layout `channelIds` reorders members relative to library effective membership order.
 * Empty / missing hints are not overrides (assemble falls back to effective ids).
 */
export function isZoneMemberOrderOverridden(
  zone: Zone,
  zones: Zone[],
  layoutChannelIds: string[] | undefined,
): boolean {
  const effective = resolveEffectiveZoneChannelIds(zone, zones);
  if (!layoutChannelIds?.length) return false;
  const ordered = orderChannelIdsByLayoutHint(effective, layoutChannelIds);
  return !channelIdSequencesEqual(ordered, effective);
}

/** Write layout `channelIds` back to library-derived effective membership order. */
export function resetZoneMemberOrderToLibrary(
  section: ZoneGroupingLayout,
  zone: Zone,
  zones: Zone[],
): ZoneGroupingLayout {
  return updateZoneChannelIds(section, zone.id, resolveEffectiveZoneChannelIds(zone, zones));
}

/** Confirm copy for clearing a zone member export-order hint. */
export function zoneMemberOrderResetConfirmMessage(): string {
  return (
    'Reset member export order to the library default?\n\n' +
    'This clears the build order hint for this zone. Restoring the previous order requires manual reorder.'
  );
}

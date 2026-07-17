import type { BuildEntityOverride } from '@core/models/formatBuild.ts';
import type { Zone } from '@core/models/library.ts';
import { overrideOrderOrSlot } from '@core/domain/formatBuildOverrides.ts';

/** Resolve 1-based list position for a zone: build override → library order → unset. */
export function resolveZoneListOrder(
  zone: Zone,
  zoneOverrides: BuildEntityOverride[],
): number | undefined {
  const override = overrideOrderOrSlot(zoneOverrides, zone.id);
  if (override != null) return override;
  if (zone.order != null && Number.isFinite(zone.order) && zone.order >= 1) {
    return Math.trunc(zone.order);
  }
  return undefined;
}

/**
 * Sort zones for export / layout sync.
 * Explicit order ascending; unset orders after set ones; name tie-break (locale-aware).
 */
export function sortZonesByExportOrder(
  zones: readonly Zone[],
  zoneOverrides: BuildEntityOverride[] = [],
): Zone[] {
  return [...zones].sort((a, b) => {
    const orderA = resolveZoneListOrder(a, zoneOverrides);
    const orderB = resolveZoneListOrder(b, zoneOverrides);
    const hasA = orderA != null;
    const hasB = orderB != null;
    if (hasA && hasB && orderA !== orderB) return orderA! - orderB!;
    if (hasA && !hasB) return -1;
    if (!hasA && hasB) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Rewrite dense 1…n `order` on zones matching `orderedZoneIds`; clear order on others. */
export function applyDenseZoneOrders(zones: Zone[], orderedZoneIds: string[]): Zone[] {
  const orderById = new Map(orderedZoneIds.map((id, index) => [id, index + 1]));
  return zones.map((zone) => {
    const nextOrder = orderById.get(zone.id);
    if (nextOrder == null) {
      if (zone.order == null) return zone;
      const { order: _removed, ...rest } = zone;
      return rest;
    }
    if (zone.order === nextOrder) return zone;
    return { ...zone, order: nextOrder };
  });
}

/** Move selected zone ids as a block within the ordered id list. */
export function reorderZoneIds(
  orderedZoneIds: string[],
  selectedIds: ReadonlySet<string>,
  direction: 'up' | 'down',
): string[] {
  return reorderSelectedKeys(orderedZoneIds, selectedIds, direction);
}

/** Generic block move for an ordered key list (shared by membership helpers). */
export function reorderSelectedKeys(
  keys: string[],
  selected: ReadonlySet<string>,
  direction: 'up' | 'down',
): string[] {
  const next = [...keys];
  const indices = next
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => selected.has(key))
    .map(({ index }) => index);

  if (direction === 'up') {
    for (const index of indices.sort((a, b) => a - b)) {
      if (index === 0) continue;
      const above = index - 1;
      if (selected.has(next[above]!)) continue;
      [next[above], next[index]] = [next[index]!, next[above]!];
    }
  } else {
    for (const index of indices.sort((a, b) => b - a)) {
      if (index >= next.length - 1) continue;
      const below = index + 1;
      if (selected.has(next[below]!)) continue;
      [next[below], next[index]] = [next[index]!, next[below]!];
    }
  }
  return next;
}

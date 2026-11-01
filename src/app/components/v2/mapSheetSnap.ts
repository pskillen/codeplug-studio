/** Pure snap logic for {@link MapSheet}: kept DOM-free so it can be unit tested. */

export type MapSheetSnap = 'peek' | 'half' | 'full';

export const MAP_SHEET_SNAPS: readonly MapSheetSnap[] = ['peek', 'half', 'full'];

export interface MapSheetSnapOptions {
  /** Height of the sheet at `peek`, in px (handle + header). */
  peekPx: number;
  /** Space left above the sheet at `full`, in px (room for floating map controls). */
  fullTopInsetPx: number;
}

export const DEFAULT_PEEK_PX = 148;
export const DEFAULT_FULL_TOP_INSET_PX = 84;

/** Sheet height in px for each snap point inside a container of `containerPx` height. */
export function snapHeights(
  containerPx: number,
  { peekPx, fullTopInsetPx }: MapSheetSnapOptions,
): Record<MapSheetSnap, number> {
  const full = Math.max(peekPx + 80, containerPx - fullTopInsetPx);
  const half = Math.min(full - 40, Math.max(peekPx + 60, Math.round(containerPx * 0.5)));
  return { peek: peekPx, half, full };
}

/**
 * Snap point to settle on after a drag ends. `velocityPxPerMs` is positive when the sheet is being
 * pulled up (growing). A fast flick moves to the next snap in that direction; otherwise the
 * nearest snap by height wins.
 */
export function snapAfterDrag(
  heightPx: number,
  heights: Record<MapSheetSnap, number>,
  velocityPxPerMs = 0,
  flickThreshold = 0.6,
): MapSheetSnap {
  if (Math.abs(velocityPxPerMs) >= flickThreshold) {
    const up = velocityPxPerMs > 0;
    const ordered = MAP_SHEET_SNAPS.map((s) => ({ s, h: heights[s] }));
    const candidates = up
      ? ordered.filter((o) => o.h > heightPx + 1)
      : ordered.filter((o) => o.h < heightPx - 1).reverse();
    if (candidates.length > 0) return candidates[0].s;
    return up ? 'full' : 'peek';
  }
  let best: MapSheetSnap = 'peek';
  let bestDist = Number.POSITIVE_INFINITY;
  for (const s of MAP_SHEET_SNAPS) {
    const d = Math.abs(heights[s] - heightPx);
    if (d < bestDist) {
      best = s;
      bestDist = d;
    }
  }
  return best;
}

/** Snap reached by tapping the handle: peek -> half -> full -> peek. */
export function nextSnap(current: MapSheetSnap): MapSheetSnap {
  return current === 'peek' ? 'half' : current === 'half' ? 'full' : 'peek';
}

export type MapListView = 'map' | 'list';

/** Map | List toggle -> sheet snap (Map shows the map, List fills the screen). */
export function snapForView(view: MapListView): MapSheetSnap {
  return view === 'map' ? 'peek' : 'full';
}

/** Sheet snap -> highlighted Map | List segment. Half counts as Map: the map is still visible. */
export function viewForSnap(snap: MapSheetSnap): MapListView {
  return snap === 'full' ? 'list' : 'map';
}

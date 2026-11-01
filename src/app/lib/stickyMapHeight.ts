/** Smallest height a sticky list-pane map is allowed to take, in px. */
export const STICKY_MAP_MIN_PX = 360;
/** Gap kept between a sticky map and the viewport edges, in px. */
export const STICKY_MAP_GUTTER_PX = 12;

/**
 * Height for a sticky map pane that starts `documentTopPx` below the top of the page: it fills the
 * rest of the first screen (viewport minus app chrome) and never exceeds the viewport minus gutters.
 */
export function stickyMapHeight(viewportPx: number, documentTopPx: number): number {
  const max = Math.max(STICKY_MAP_MIN_PX, viewportPx - 2 * STICKY_MAP_GUTTER_PX);
  const fit = viewportPx - documentTopPx - STICKY_MAP_GUTTER_PX;
  return Math.round(Math.min(max, Math.max(STICKY_MAP_MIN_PX, fit)));
}

/** Smallest height a sticky list-pane map is allowed to take, in px. */
export const STICKY_MAP_MIN_PX = 360;
/** Gap kept between a sticky map and the viewport edges, in px. */
export const STICKY_MAP_GUTTER_PX = 12;

/**
 * Height for a sticky map pane that starts `documentTopPx` below the top of the page: it fills the
 * rest of the first screen (viewport minus app chrome) and never exceeds the viewport minus gutters.
 * A pane that starts near or below the fold (results under a search form) gets the full height,
 * since it only shows once the page has scrolled and the map has stuck.
 */
export function stickyMapHeight(viewportPx: number, documentTopPx: number): number {
  const max = Math.max(STICKY_MAP_MIN_PX, viewportPx - 2 * STICKY_MAP_GUTTER_PX);
  const fit = viewportPx - documentTopPx - STICKY_MAP_GUTTER_PX;
  return Math.round(fit < STICKY_MAP_MIN_PX ? max : Math.min(max, fit));
}

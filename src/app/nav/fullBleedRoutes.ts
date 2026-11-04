/**
 * Library pages that are a list + map: on mobile they become list | map swipe panes with a bottom
 * controls sheet. The directory searches with coordinates (not BrandMeister, which has no map) do
 * the same once you are on a phone.
 */
const MOBILE_FULL_BLEED_PATHS: readonly string[] = [
  '/library/channels',
  '/library/zones',
  '/library/channels/add-from-ukrepeater',
  '/library/channels/add-from-irts',
  '/library/channels/add-from-repeaterbook',
];

/**
 * Pages that fill the viewport below the chrome instead of scrolling inside a padded column.
 * Map tools (`/tools/*`) always do; the Channels and Zones lists and the repeater directory
 * searches do on mobile only (swipe panes + controls sheet).
 */
export function isFullBleedPath(pathname: string, mobile = false): boolean {
  if (pathname === '/tools' || pathname.startsWith('/tools/')) return true;
  if (!mobile) return false;
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return MOBILE_FULL_BLEED_PATHS.includes(trimmed);
}

/**
 * Pages whose desktop body uses the full window width instead of the centred 75% column: the
 * list + map pages above, where the column left the map pane a sliver at mid-width windows (#1524).
 */
export function isWideDesktopPath(pathname: string): boolean {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return MOBILE_FULL_BLEED_PATHS.includes(trimmed);
}

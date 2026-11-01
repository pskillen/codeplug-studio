/** Library list pages that are a list + map: on mobile they become a full-screen map under a bottom sheet. */
const MOBILE_FULL_BLEED_PATHS: readonly string[] = ['/library/channels', '/library/zones'];

/**
 * Pages that fill the viewport below the chrome instead of scrolling inside a padded column.
 * Map tools (`/tools/*`) always do; the Channels and Zones lists do on mobile only (map-first sheet).
 */
export function isFullBleedPath(pathname: string, mobile = false): boolean {
  if (pathname === '/tools' || pathname.startsWith('/tools/')) return true;
  if (!mobile) return false;
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return MOBILE_FULL_BLEED_PATHS.includes(trimmed);
}

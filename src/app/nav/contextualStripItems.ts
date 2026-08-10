/**
 * Flat pill-strip destinations for the v2 ContextualStrip under each top tab.
 * Labels match the design-system reference kit (`libStrip` / Tools / Help).
 */

export interface ContextualStripItem {
  label: string;
  to: string;
}

/** Library entity types — design-system `libStrip` wording. */
export const libraryStripItems: readonly ContextualStripItem[] = [
  { label: 'Channels', to: '/library/channels' },
  { label: 'Zones', to: '/library/zones' },
  { label: 'Talk groups', to: '/library/talk-groups' },
  { label: 'Contacts', to: '/library/contacts' },
  { label: 'Receive group lists', to: '/library/rx-group-lists' },
  { label: 'Scan lists', to: '/library/scan-lists' },
  { label: 'APRS setup', to: '/library/aprs-configuration' },
  { label: 'Satellite Keps', to: '/library/satellite-keps' },
];

export const toolsStripItems: readonly ContextualStripItem[] = [
  { label: 'Maidenhead locator', to: '/reference/maidenhead' },
  { label: 'Band plan', to: '/reference/bands' },
  { label: 'Tracking Dashboard', to: '/tracking' },
];

export const helpStripItems: readonly ContextualStripItem[] = [
  { label: 'Overview', to: '/help' },
  { label: 'Attributions', to: '/attributions' },
];

export const settingsStripItems: readonly ContextualStripItem[] = [
  { label: 'Settings', to: '/settings' },
];

export const debugStripItems: readonly ContextualStripItem[] = [
  { label: 'Overview', to: '/debug' },
  { label: 'IndexedDB', to: '/debug/indexed-db' },
  { label: 'localStorage', to: '/debug/local-storage' },
];

/**
 * Resolve strip items for the current pathname. Returns null when the route
 * has no sub-nav (Summary, builds list / new, home). Build-detail strips are
 * dynamic (trait-shaped) and resolved by the chrome shell from `buildNavItems`.
 */
export function resolveContextualStripItems(
  pathname: string,
): readonly ContextualStripItem[] | null {
  if (pathname.startsWith('/library')) return libraryStripItems;
  if (pathname.startsWith('/reference') || pathname.startsWith('/tracking')) {
    return toolsStripItems;
  }
  if (pathname.startsWith('/help') || pathname.startsWith('/attributions')) {
    return helpStripItems;
  }
  if (pathname.startsWith('/settings')) return settingsStripItems;
  if (pathname.startsWith('/debug')) return debugStripItems;
  return null;
}

/** Active strip label for pathname, or null when none match. */
export function activeContextualStripLabel(
  pathname: string,
  items: readonly ContextualStripItem[],
): string | null {
  // Longest path prefix wins (e.g. /help vs /help never nested; attributions separate).
  let best: ContextualStripItem | null = null;
  for (const item of items) {
    if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
      if (!best || item.to.length > best.to.length) best = item;
    }
  }
  return best?.label ?? null;
}

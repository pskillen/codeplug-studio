/**
 * Flat pill-strip destinations for the v2 ContextualStrip under each top tab.
 * Labels match the design-system reference kit (`libStrip` / Tools / Help).
 */

import {
  IconBroadcast,
  IconCpu,
  IconCurrentLocation,
  IconListDetails,
  IconRoute,
  IconRadar,
  IconTerminal2,
  IconWaveSine,
} from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';
import { listOfferedFirmwareUpdaters } from '../services/firmwareFlashEnvGate.ts';

export interface ContextualStripItem {
  label: string;
  to: string;
  /** When true, `to` is an off-Studio URL — open in a new tab instead of routing. */
  external?: boolean;
  /** Optional icon shown before the label. */
  icon?: TablerIcon;
}

const PROPAGATION_VISUALISER_URL = 'https://propagation.mm9pdy.net/';

/** Library entity types — design-system `libStrip` wording. */
export const libraryStripItems: readonly ContextualStripItem[] = [
  { label: 'Channels', to: '/library/channels' },
  { label: 'Zones', to: '/library/zones' },
  { label: 'Talk groups', to: '/library/talk-groups' },
  { label: 'Contacts', to: '/library/contacts' },
  { label: 'Digital IDs', to: '/library/digital-ids' },
  { label: 'Receive group lists', to: '/library/rx-group-lists' },
  { label: 'Scan lists', to: '/library/scan-lists' },
  { label: 'APRS setup', to: '/library/aprs-configuration' },
  { label: 'Satellite Keps', to: '/library/satellite-keps' },
];

/**
 * Tools strip. **Propagation Visualiser** moved off-Studio to
 * propagation.mm9pdy.net. It is hidden for now (the site is down) but kept so it can come back by flipping
 * {@link SHOW_PROPAGATION_VISUALISER}.
 */
export const FIRMWARE_FLASHER_STRIP_ITEM: ContextualStripItem = {
  label: 'Firmware flasher',
  to: '/firmware',
  icon: IconCpu,
};

export const PROPAGATION_VISUALISER_STRIP_ITEM: ContextualStripItem = {
  label: 'Propagation Visualiser',
  to: PROPAGATION_VISUALISER_URL,
  external: true,
  icon: IconWaveSine,
};

/** False while propagation.mm9pdy.net is down; set true to bring the link back to the strip and Tools page. */
export const SHOW_PROPAGATION_VISUALISER = false;

/** Field tools: ephemeral, map-first, no project needed (#1497). */
export const FIELD_TOOL_STRIP_ITEMS: readonly ContextualStripItem[] = [
  { label: 'My locator', to: '/tools/locator', icon: IconCurrentLocation },
  { label: 'Distance & bearing', to: '/tools/bearing', icon: IconRoute },
  { label: 'Nearby repeaters', to: '/tools/nearby', icon: IconBroadcast },
];

/**
 * Tools strip items for a build. The firmware flasher appears only when this build and platform offer at least
 * one radio (per-radio prod gate; hidden on Capacitor). Pure: pass `firmwareOffered` in tests.
 */
export function buildToolsStripItems(
  firmwareOffered: boolean,
  showPropagation: boolean = SHOW_PROPAGATION_VISUALISER,
): readonly ContextualStripItem[] {
  return [
    ...FIELD_TOOL_STRIP_ITEMS,
    { label: 'Band plan', to: '/reference/bands', icon: IconListDetails },
    { label: 'Tracking Dashboard', to: '/tracking', icon: IconRadar },
    ...(firmwareOffered ? [FIRMWARE_FLASHER_STRIP_ITEM] : []),
    ...(showPropagation ? [PROPAGATION_VISUALISER_STRIP_ITEM] : []),
  ];
}

/**
 * Tools strip for this build, platform and device. Build env and platform are fixed at runtime; developer mode
 * (#1650) is not, so pass it from `useDeveloperMode` in components (default: read at call time).
 */
export function resolveToolsStripItems(developerMode?: boolean): readonly ContextualStripItem[] {
  return buildToolsStripItems(listOfferedFirmwareUpdaters(undefined, developerMode).length > 0);
}

export const helpStripItems: readonly ContextualStripItem[] = [
  { label: 'Overview', to: '/help' },
  { label: 'Attributions', to: '/attributions' },
];

export const settingsStripItems: readonly ContextualStripItem[] = [
  { label: 'Settings', to: '/settings' },
];

/**
 * The Debug section's icon (#1673): a terminal prompt, which reads as developer tooling. A bug reads as "report a
 * bug", and the developer-mode badge already uses the code-brackets icon. Used on the Tools page's Debug entry, the
 * avatar menu's Debug item and the Debug strip.
 */
export const DEBUG_SECTION_ICON: TablerIcon = IconTerminal2;

export const debugStripItems: readonly ContextualStripItem[] = [
  { label: 'Overview', to: '/debug', icon: DEBUG_SECTION_ICON },
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
  developerMode?: boolean,
): readonly ContextualStripItem[] | null {
  if (pathname.startsWith('/library')) return libraryStripItems;
  if (
    pathname.startsWith('/reference') ||
    pathname.startsWith('/tools') ||
    pathname.startsWith('/tracking') ||
    pathname.startsWith('/firmware')
  ) {
    return resolveToolsStripItems(developerMode);
  }
  if (pathname.startsWith('/help') || pathname.startsWith('/attributions')) {
    return helpStripItems;
  }
  if (pathname.startsWith('/settings')) return settingsStripItems;
  if (pathname.startsWith('/debug')) return debugStripItems;
  return null;
}

/** Active strip label for pathname, or null when none match. External items never match. */
export function activeContextualStripLabel(
  pathname: string,
  items: readonly ContextualStripItem[],
): string | null {
  // Longest path prefix wins (e.g. /help vs /help never nested; attributions separate).
  let best: ContextualStripItem | null = null;
  for (const item of items) {
    if (item.external) continue;
    if (pathname === item.to || pathname.startsWith(`${item.to}/`)) {
      if (!best || item.to.length > best.to.length) best = item;
    }
  }
  return best?.label ?? null;
}

/** A Debug page as the Tools page lists it (#1673). */
export interface DebugToolLink {
  label: string;
  to: string;
  /** Talks to a radio or cable over Web Serial: desktop Chrome or Edge only, never the Android app. */
  webSerialOnly?: boolean;
}

/**
 * The Debug pages the Tools page links to, shown only where the Debug pages gate allows them. Pages with route
 * parameters (an IndexedDB store or row, a localStorage key) are reached from their parent page.
 */
export const DEBUG_TOOL_LINKS: readonly DebugToolLink[] = [
  { label: 'Debug overview', to: '/debug' },
  { label: 'IndexedDB', to: '/debug/indexed-db' },
  { label: 'localStorage', to: '/debug/local-storage' },
  { label: 'AT-D890UV erase-unit probe', to: '/debug/d890-erase-probe', webSerialOnly: true },
  { label: 'Serial reopen timing', to: '/debug/serial-reopen', webSerialOnly: true },
  { label: 'UV-5R Mini full read', to: '/debug/uv5r-mini', webSerialOnly: true },
];

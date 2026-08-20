import {
  IconBooks,
  IconChartBar,
  IconHammer,
  IconHelp,
  IconHome,
  IconTool,
} from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';
import type { Library } from '@core/models/library.ts';

export type LibraryCountKey = keyof Pick<
  Library,
  'channels' | 'zones' | 'talkGroups' | 'digitalContacts' | 'analogContacts' | 'rxGroupLists'
>;

export interface PrimaryNavItem {
  to: string;
  label: string;
  icon: TablerIcon;
  countKey?: LibraryCountKey;
  /**
   * When true, the tab only applies with an active project (Library / Summary /
   * Export for radio). Tools and Help stay reachable without a project.
   */
  requiresProject?: boolean;
}

/**
 * Top-level chrome tabs — Summary → Library → Export for radio → Tools →
 * Help. Routes stay at existing paths (`/reference` for Tools) so deep links
 * and RequireActiveProject guards do not change.
 *
 * Tracking Dashboard (`/tracking`) is reachable from the Tools contextual
 * strip (`toolsStripItems` in `contextualStripItems.ts`), not as a top-level
 * tab — the route itself still requires an active project.
 */
export const primaryNavItems: PrimaryNavItem[] = [
  { to: '/summary', label: 'Summary', icon: IconChartBar, requiresProject: true },
  {
    to: '/library',
    label: 'Library',
    icon: IconBooks,
    countKey: 'channels',
    requiresProject: true,
  },
  { to: '/builds', label: 'Export for radio', icon: IconHammer, requiresProject: true },
  { to: '/reference', label: 'Tools', icon: IconTool },
  { to: '/help', label: 'Help', icon: IconHelp },
];

/** Project-scoped subset of {@link primaryNavItems} (excludes Tools / Help). */
export const projectNavItems: PrimaryNavItem[] = primaryNavItems.filter(
  (item) => item.requiresProject,
);

export const homeNavItem = { to: '/', label: 'Projects', icon: IconHome };

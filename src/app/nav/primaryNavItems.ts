import {
  IconBooks,
  IconChartBar,
  IconHammer,
  IconHelp,
  IconHome,
  IconSatellite,
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
 * Top-level chrome tabs — design-system order (Summary → Library → Tools →
 * Export for radio → Help). Routes stay at existing paths (`/reference` for
 * Tools) so deep links and RequireActiveProject guards do not change.
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
  { to: '/reference', label: 'Tools', icon: IconTool },
  { to: '/builds', label: 'Export for radio', icon: IconHammer, requiresProject: true },
  { to: '/tracking', label: 'Tracking Dashboard', icon: IconSatellite, requiresProject: true },
  { to: '/help', label: 'Help', icon: IconHelp },
];

/** Project-scoped subset of {@link primaryNavItems} (excludes Tools / Help). */
export const projectNavItems: PrimaryNavItem[] = primaryNavItems.filter(
  (item) => item.requiresProject,
);

export const homeNavItem = { to: '/', label: 'Projects', icon: IconHome };

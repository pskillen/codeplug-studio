import { IconBooks, IconChartBar, IconHammer, IconHome } from '@tabler/icons-react';
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
}

export const projectNavItems: PrimaryNavItem[] = [
  { to: '/library', label: 'Library', icon: IconBooks, countKey: 'channels' },
  { to: '/summary', label: 'Summary', icon: IconChartBar },
  { to: '/builds', label: 'Export for radio', icon: IconHammer },
];

export const homeNavItem = { to: '/', label: 'Projects', icon: IconHome };

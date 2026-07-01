import HelpSectionNav from '../components/SectionNav/sections/HelpSectionNav.tsx';
import LibrarySectionNav from '../components/SectionNav/sections/LibrarySectionNav.tsx';
import ReferenceSectionNav from '../components/SectionNav/sections/ReferenceSectionNav.tsx';
import SettingsSectionNav from '../components/SectionNav/sections/SettingsSectionNav.tsx';
import type { SectionNavEntry } from './sectionNavTypes.ts';

const registry: SectionNavEntry[] = [
  { title: 'Help', prefix: '/help', Component: HelpSectionNav },
  { title: 'Reference', prefix: '/reference', Component: ReferenceSectionNav },
  { title: 'Settings', prefix: '/settings', Component: SettingsSectionNav },
  { title: 'Library', prefix: '/library', Component: LibrarySectionNav },
];

export function resolveSectionNav(pathname: string): SectionNavEntry | null {
  for (const entry of registry) {
    if (pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`)) {
      return entry;
    }
  }
  return null;
}

export function shouldShowSecondaryNav(pathname: string, hasActiveProject: boolean): boolean {
  if (pathname === '/') return false;
  const entry = resolveSectionNav(pathname);
  if (!entry) return false;
  if (
    pathname.startsWith('/help') ||
    pathname.startsWith('/reference') ||
    pathname.startsWith('/settings')
  ) {
    return true;
  }
  return hasActiveProject;
}

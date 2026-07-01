import ChannelsSectionNav from '../components/SectionNav/sections/ChannelsSectionNav.tsx';
import ContactsSectionNav from '../components/SectionNav/sections/ContactsSectionNav.tsx';
import HelpSectionNav from '../components/SectionNav/sections/HelpSectionNav.tsx';
import ReferenceSectionNav from '../components/SectionNav/sections/ReferenceSectionNav.tsx';
import RxGroupListsSectionNav from '../components/SectionNav/sections/RxGroupListsSectionNav.tsx';
import SettingsSectionNav from '../components/SectionNav/sections/SettingsSectionNav.tsx';
import TalkGroupsSectionNav from '../components/SectionNav/sections/TalkGroupsSectionNav.tsx';
import ZonesSectionNav from '../components/SectionNav/sections/ZonesSectionNav.tsx';
import type { SectionNavEntry } from './sectionNavTypes.ts';

/** Longest prefix first — more specific library list routes win over `/library`. */
const registry: SectionNavEntry[] = [
  { title: 'Help', prefix: '/help', Component: HelpSectionNav },
  { title: 'Reference', prefix: '/reference', Component: ReferenceSectionNav },
  { title: 'Settings', prefix: '/settings', Component: SettingsSectionNav },
  { title: 'Channels', prefix: '/library/channels', Component: ChannelsSectionNav },
  { title: 'Zones', prefix: '/library/zones', Component: ZonesSectionNav },
  { title: 'Talk groups', prefix: '/library/talk-groups', Component: TalkGroupsSectionNav },
  { title: 'Contacts', prefix: '/library/contacts', Component: ContactsSectionNav },
  { title: 'RX group lists', prefix: '/library/rx-group-lists', Component: RxGroupListsSectionNav },
  { title: 'Library', prefix: '/library', Component: ChannelsSectionNav },
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

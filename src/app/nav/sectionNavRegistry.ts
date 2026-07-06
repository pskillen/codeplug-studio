import ChannelsAndZonesSectionNav from '../components/SectionNav/sections/ChannelsAndZonesSectionNav.tsx';
import ContactsSectionNav from '../components/SectionNav/sections/ContactsSectionNav.tsx';
import DebugSectionNav from '../components/SectionNav/sections/DebugSectionNav.tsx';
import HelpSectionNav from '../components/SectionNav/sections/HelpSectionNav.tsx';
import BandsReferenceSectionNav from '../components/SectionNav/sections/BandsReferenceSectionNav.tsx';
import MaidenheadReferenceSectionNav from '../components/SectionNav/sections/MaidenheadReferenceSectionNav.tsx';
import ReferenceSectionNav from '../components/SectionNav/sections/ReferenceSectionNav.tsx';
import RxGroupListsSectionNav from '../components/SectionNav/sections/RxGroupListsSectionNav.tsx';
import SettingsSectionNav from '../components/SectionNav/sections/SettingsSectionNav.tsx';
import TalkGroupsSectionNav from '../components/SectionNav/sections/TalkGroupsSectionNav.tsx';
import BuildsSectionNav from '../components/SectionNav/sections/BuildsSectionNav.tsx';
import type { SectionNavEntry } from './sectionNavTypes.ts';
import { isBuildDetailPath } from '../routes/builds/nav.ts';

/** Longest prefix first — more specific library list routes win over `/library`. */
const registry: SectionNavEntry[] = [
  { title: 'Help', prefix: '/help', Component: HelpSectionNav },
  {
    title: 'Maidenhead',
    prefix: '/reference/maidenhead',
    Component: MaidenheadReferenceSectionNav,
  },
  { title: 'Bands', prefix: '/reference/bands', Component: BandsReferenceSectionNav },
  { title: 'Reference', prefix: '/reference', Component: ReferenceSectionNav },
  { title: 'Debug', prefix: '/debug', Component: DebugSectionNav },
  { title: 'Settings', prefix: '/settings', Component: SettingsSectionNav },
  { title: 'Channels & zones', prefix: '/library/zones', Component: ChannelsAndZonesSectionNav },
  { title: 'Channels & zones', prefix: '/library/channels', Component: ChannelsAndZonesSectionNav },
  { title: 'Talk groups', prefix: '/library/talk-groups', Component: TalkGroupsSectionNav },
  { title: 'Contacts', prefix: '/library/contacts', Component: ContactsSectionNav },
  { title: 'RX group lists', prefix: '/library/rx-group-lists', Component: RxGroupListsSectionNav },
  { title: 'Library', prefix: '/library', Component: ChannelsAndZonesSectionNav },
  { title: 'Radio build', prefix: '/builds', Component: BuildsSectionNav },
];

export function resolveSectionNav(pathname: string): SectionNavEntry | null {
  if (pathname === '/builds/new' || pathname === '/builds') {
    return null;
  }
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
    pathname.startsWith('/debug') ||
    pathname.startsWith('/settings')
  ) {
    return true;
  }
  if (isBuildDetailPath(pathname)) {
    return hasActiveProject;
  }
  return hasActiveProject;
}

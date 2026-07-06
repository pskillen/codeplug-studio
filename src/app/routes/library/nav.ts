/** Library list-route catalog — section nav order and editor back-link targets. */

export interface LibraryNavEntry {
  label: string;
  plural: string;
  listPath: string;
  editorSlugs: string[];
  sectionNavTitle: string;
}

const CHANNELS_ZONES_PATH = '/library/zones?pivot=all';

export const LIBRARY_NAV: LibraryNavEntry[] = [
  {
    label: 'Channel & zone',
    plural: 'Channels & zones',
    listPath: '/library/zones',
    editorSlugs: ['channels', 'zones'],
    sectionNavTitle: 'Channels & zones',
  },
  {
    label: 'Talk group',
    plural: 'Talk groups',
    listPath: '/library/talk-groups',
    editorSlugs: ['talk-groups'],
    sectionNavTitle: 'Talk groups',
  },
  {
    label: 'Contact',
    plural: 'Contacts',
    listPath: '/library/contacts',
    editorSlugs: ['digital-contacts', 'analog-contacts'],
    sectionNavTitle: 'Contacts',
  },
  {
    label: 'RX group list',
    plural: 'RX group lists',
    listPath: '/library/rx-group-lists',
    editorSlugs: ['rx-group-lists'],
    sectionNavTitle: 'RX group lists',
  },
];

export function listPathForEditorSlug(slug: string): string {
  if (slug === 'channels' || slug === 'zones') return CHANNELS_ZONES_PATH;
  return LIBRARY_NAV.find((e) => e.editorSlugs.includes(slug))?.listPath ?? CHANNELS_ZONES_PATH;
}

export function navEntryForListPath(pathname: string): LibraryNavEntry | undefined {
  if (pathname === '/library/channels' || pathname.startsWith('/library/channels/')) {
    return LIBRARY_NAV[0];
  }
  return LIBRARY_NAV.find((e) => pathname === e.listPath || pathname.startsWith(`${e.listPath}/`));
}

export { CHANNELS_ZONES_PATH };

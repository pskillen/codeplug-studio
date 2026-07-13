/** Library list-route catalog — section nav order and editor back-link targets. */

export interface LibraryNavEntry {
  label: string;
  plural: string;
  listPath: string;
  editorSlugs: string[];
  sectionNavTitle: string;
}

export const LIBRARY_NAV: LibraryNavEntry[] = [
  {
    label: 'Channel',
    plural: 'Channels',
    listPath: '/library/channels',
    editorSlugs: ['channels'],
    sectionNavTitle: 'Channels',
  },
  {
    label: 'Zone',
    plural: 'Zones',
    listPath: '/library/zones',
    editorSlugs: ['zones'],
    sectionNavTitle: 'Zones',
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
  {
    label: 'Scan list',
    plural: 'Scan lists',
    listPath: '/library/scan-lists',
    editorSlugs: ['scan-lists'],
    sectionNavTitle: 'Scan lists',
  },
  {
    label: 'APRS configuration',
    plural: 'APRS configurations',
    listPath: '/library/aprs-configurations',
    editorSlugs: ['aprs-configurations'],
    sectionNavTitle: 'APRS configurations',
  },
];

export function listPathForEditorSlug(slug: string): string {
  return LIBRARY_NAV.find((e) => e.editorSlugs.includes(slug))?.listPath ?? '/library/channels';
}

export function navEntryForListPath(pathname: string): LibraryNavEntry | undefined {
  return LIBRARY_NAV.find((e) => pathname === e.listPath || pathname.startsWith(`${e.listPath}/`));
}

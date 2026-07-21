/** Library list-route catalog — section nav order and editor back-link targets. */

import type { TablerIcon } from '@tabler/icons-react';
import { entityNavIcons } from '../../nav/entityNavIcons.ts';

export interface LibraryNavEntry {
  label: string;
  plural: string;
  listPath: string;
  editorSlugs: string[];
  sectionNavTitle: string;
  icon: TablerIcon;
}

export const LIBRARY_NAV: LibraryNavEntry[] = [
  {
    label: 'Channel',
    plural: 'Channels',
    listPath: '/library/channels',
    editorSlugs: ['channels'],
    sectionNavTitle: 'Channels',
    icon: entityNavIcons.channels,
  },
  {
    label: 'Zone',
    plural: 'Zones',
    listPath: '/library/zones',
    editorSlugs: ['zones'],
    sectionNavTitle: 'Zones',
    icon: entityNavIcons.zones,
  },
  {
    label: 'Talk group',
    plural: 'Talk groups',
    listPath: '/library/talk-groups',
    editorSlugs: ['talk-groups'],
    sectionNavTitle: 'Talk groups',
    icon: entityNavIcons.talkGroups,
  },
  {
    label: 'Contact',
    plural: 'Contacts',
    listPath: '/library/contacts',
    editorSlugs: ['digital-contacts', 'analog-contacts'],
    sectionNavTitle: 'Contacts',
    icon: entityNavIcons.contacts,
  },
  {
    label: 'Receive Group List',
    plural: 'Receive Group Lists',
    listPath: '/library/rx-group-lists',
    editorSlugs: ['rx-group-lists'],
    sectionNavTitle: 'Receive Group Lists',
    icon: entityNavIcons.rxGroupLists,
  },
  {
    label: 'Scan list',
    plural: 'Scan lists',
    listPath: '/library/scan-lists',
    editorSlugs: ['scan-lists'],
    sectionNavTitle: 'Scan lists',
    icon: entityNavIcons.scanLists,
  },
  {
    label: 'APRS configuration',
    plural: 'APRS configuration',
    listPath: '/library/aprs-configuration',
    editorSlugs: ['aprs-configuration'],
    sectionNavTitle: 'APRS configuration',
    icon: entityNavIcons.aprsConfiguration,
  },
];

export function listPathForEditorSlug(slug: string): string {
  return LIBRARY_NAV.find((e) => e.editorSlugs.includes(slug))?.listPath ?? '/library/channels';
}

export function navEntryForListPath(pathname: string): LibraryNavEntry | undefined {
  return LIBRARY_NAV.find((e) => pathname === e.listPath || pathname.startsWith(`${e.listPath}/`));
}

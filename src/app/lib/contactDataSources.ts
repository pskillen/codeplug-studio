import type { TablerIcon } from '@tabler/icons-react';
import { IconId } from '@tabler/icons-react';
import type { BadgeCardBadge } from '../components/ui/BadgeCard.tsx';

export interface ContactDataSource {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  badges: readonly BadgeCardBadge[];
  Icon: TablerIcon;
}

export const CONTACT_DATA_SOURCES: readonly ContactDataSource[] = [
  {
    id: 'radioid',
    title: 'RadioID.net',
    subtitle: 'DMR ID directory',
    description:
      'Search the worldwide RadioID.net DMR user database by callsign, ID, or location. Import private contacts with full metadata.',
    path: '/library/contacts/add-from-radioid',
    badges: [{ label: 'DMR' }, { label: 'Worldwide' }, { label: 'Private contacts' }],
    Icon: IconId,
  },
];

export const CONTACT_ADD_SOURCES: readonly ContactDataSource[] = [...CONTACT_DATA_SOURCES];

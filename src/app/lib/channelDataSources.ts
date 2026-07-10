import type { TablerIcon } from '@tabler/icons-react';
import { IconAntenna, IconPlane, IconPlaylistAdd, IconRadio, IconTower } from '@tabler/icons-react';
import type { BadgeCardBadge } from '../components/ui/BadgeCard.tsx';

export interface ChannelDataSource {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  path: string;
  badges: readonly BadgeCardBadge[];
  Icon: TablerIcon;
}

export const CHANNEL_SET_SOURCE: ChannelDataSource = {
  id: 'channel-set',
  title: 'Channel set',
  subtitle: 'Built-in grids',
  description:
    'Import curated frequency grids such as PMR446, UK CB, and UK simplex calling channels into your library.',
  path: '/library/channels/add-channel-set',
  badges: [{ label: 'PMR446' }, { label: 'CB' }, { label: 'Simplex' }],
  Icon: IconPlaylistAdd,
};

/** External directory and API sources (ukrepeater, OpenAIP, BrandMeister). */
export const CHANNEL_DATA_SOURCES: readonly ChannelDataSource[] = [
  {
    id: 'ukrepeater',
    title: 'ukrepeater.net',
    subtitle: 'UK repeaters',
    description:
      'Search the RSGB ETCC directory for UK repeaters by callsign, locator, or town. Import DMR, FM, and other modes.',
    path: '/library/channels/add-from-ukrepeater',
    badges: [{ emoji: '🇬🇧', label: 'UK' }, { label: 'DMR' }, { label: 'FM' }, { label: 'Verify' }],
    Icon: IconRadio,
  },
  {
    id: 'openaip',
    title: 'OpenAIP',
    subtitle: 'Aviation',
    description:
      'Search worldwide airports and import RX-only AM airband frequencies. Requires an API key in Settings.',
    path: '/library/channels/add-from-openaip',
    badges: [{ emoji: '✈️', label: 'Airband' }, { label: 'AM' }, { label: 'RX only' }],
    Icon: IconPlane,
  },
  {
    id: 'brandmeister',
    title: 'BrandMeister',
    subtitle: 'DMR network',
    description:
      'Look up BrandMeister-connected repeaters by callsign. Optionally import talk groups and RX group lists.',
    path: '/library/channels/add-from-brandmeister',
    badges: [{ label: 'DMR' }, { label: 'Talk groups' }, { label: 'RX lists' }],
    Icon: IconAntenna,
  },
  {
    id: 'irts',
    title: 'IRTS',
    subtitle: 'Ireland repeaters',
    description:
      'Browse the IRTS Republic of Ireland repeater catalogue. Import FM and DMR listings by callsign or location.',
    path: '/library/channels/add-from-irts',
    badges: [{ emoji: '🇮🇪', label: 'Ireland' }, { label: 'FM' }, { label: 'DMR' }, { label: 'Verify' }],
    Icon: IconTower,
  },
] as const;

/** All entries shown in the Library **Add from…** picker modal. */
export const CHANNEL_ADD_SOURCES: readonly ChannelDataSource[] = [
  CHANNEL_SET_SOURCE,
  ...CHANNEL_DATA_SOURCES,
];

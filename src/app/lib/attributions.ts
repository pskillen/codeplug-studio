/** External data and service credits shown on `/attributions`. */
export interface AttributionEntry {
  id: string;
  name: string;
  description: string;
  homeUrl: string;
  termsUrl?: string;
  /** Where Studio uses this source (human-readable). */
  usedIn: string[];
}

export const ATTRIBUTIONS: AttributionEntry[] = [
  {
    id: 'openaip',
    name: 'OpenAIP',
    description:
      'Worldwide airport and airband frequency data. Requests go directly from your browser with your API key.',
    homeUrl: 'https://www.openaip.net/',
    termsUrl: 'https://www.openaip.net/',
    usedIn: ['Add from OpenAIP', 'Settings → OpenAIP API key'],
  },
  {
    id: 'ukrepeater',
    name: 'ukrepeater.net / RSGB ETCC',
    description:
      'UK amateur repeater directory via the RSGB ETCC beta API. Beta — degrade gracefully on failure.',
    homeUrl: 'https://ukrepeater.net/',
    usedIn: ['Add from ukrepeater.net', 'Channel editor repeater verify'],
  },
  {
    id: 'brandmeister',
    name: 'BrandMeister',
    description: 'DMR repeater and talk-group directory for BrandMeister-connected repeaters.',
    homeUrl: 'https://brandmeister.network/',
    usedIn: ['Add from BrandMeister', 'Channel editor BrandMeister verify'],
  },
  {
    id: 'irts',
    name: 'IRTS',
    description:
      'Republic of Ireland amateur repeater listings via the IRTS Anytone CSV catalogue (proxied for browser access).',
    homeUrl: 'https://www.irts.ie/cgi/repeater.cgi',
    usedIn: ['Add from IRTS', 'Channel editor IRTS verify'],
  },
  {
    id: 'mapbox',
    name: 'Mapbox',
    description:
      'Optional geocoding for town/address search when you provide a Mapbox access token in Settings.',
    homeUrl: 'https://www.mapbox.com/',
    termsUrl: 'https://www.mapbox.com/legal/tos',
    usedIn: [
      'Settings → Map',
      'Maidenhead reference',
      'Zone from location',
      'Repeater / airport search geocode',
    ],
  },
  {
    id: 'osm-photon',
    name: 'OpenStreetMap / Photon',
    description:
      'Map tiles (© OpenStreetMap contributors) and Photon geocoding when Mapbox is not configured.',
    homeUrl: 'https://www.openstreetmap.org/copyright',
    termsUrl: 'https://photon.komoot.io/',
    usedIn: ['Codeplug map', 'Town geocode fallback', 'Maidenhead reference'],
  },
  {
    id: 'radioid',
    name: 'RadioID.net',
    description:
      'Worldwide DMR radio ID directory. Requests go through the Studio same-origin proxy; no operator API key required.',
    homeUrl: 'https://www.radioid.net/',
    termsUrl: 'https://www.radioid.net/terms_and_conditions_policy',
    usedIn: ['Add from RadioID.net (Library → Contacts)'],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description:
      'Optional cloud storage for native YAML project files. OAuth tokens stay in browser storage only.',
    homeUrl: 'https://www.google.com/drive/',
    termsUrl: 'https://policies.google.com/terms',
    usedIn: ['Settings → Google Drive', 'Import / export Drive browser'],
  },
];

export function findAttribution(id: string): AttributionEntry | undefined {
  return ATTRIBUTIONS.find((entry) => entry.id === id);
}

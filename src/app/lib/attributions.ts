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
    usedIn: ['Settings → Google Drive', 'Summary Drive browser'],
  },
  {
    id: 'chirp',
    name: 'CHIRP',
    description:
      'Open-source amateur radio programming tool. Studio’s CHIRP CSV export and future browser radio protocols draw on CHIRP’s documented wire formats and drivers — with thanks to the CHIRP project and contributors.',
    homeUrl: 'https://chirp.danplanet.com/',
    termsUrl: 'https://chirp.danplanet.com/projects/chirp/wiki/Download',
    usedIn: [
      'CHIRP CSV export (UV-5R Mini, UV-21Pro V2, RT95 VOX)',
      'UV-5R Mini binary memory reference (docs/reference/radios/baofeng/uv-5r-mini)',
      'Planned Web Serial radio I/O (protocol lineage)',
    ],
  },
  {
    id: 'neonplug',
    name: 'NeonPlug',
    description:
      'Browser CPS that reads and writes supported radios over Web Serial / BLE. Studio’s .neonplug interchange and planned direct-write work build on NeonPlug’s open MIT-licensed models and protocols — with thanks to the NeonPlug authors.',
    homeUrl: 'https://neonplug.app/',
    termsUrl: 'https://github.com/infamy/NeonPlug',
    usedIn: [
      'NeonPlug .neonplug export / merge',
      'Prefer-NeonPlug export hints (DM32, UV-5R)',
      'UV-5R Mini binary memory reference (docs/reference/radios/baofeng/uv-5r-mini)',
      'Planned Web Serial radio I/O (protocol lineage)',
    ],
  },
  {
    id: 'qdmr',
    name: 'qdmr',
    description:
      'Open-source DMR codeplug tool (GPL-3). Studio’s OpenGD77 / OpenUV380 binary memory reference extracts layout facts from qdmr’s documented offsets for planned Web Serial adapters — with thanks to the qdmr authors. Studio does not redistribute qdmr source.',
    homeUrl: 'https://dm3mat.darc.de/qdmr/',
    termsUrl: 'https://github.com/hmatuschek/qdmr',
    usedIn: [
      'OpenGD77 binary memory reference (docs/reference/radios/opengd77)',
      'Planned OpenGD77-family Web Serial radio I/O (protocol lineage)',
    ],
  },
];

export function findAttribution(id: string): AttributionEntry | undefined {
  return ATTRIBUTIONS.find((entry) => entry.id === id);
}

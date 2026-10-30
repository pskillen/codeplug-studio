/**
 * Direct-radio (Web Serial) profiles — wire limits for UI / assemble boundary.
 * No CPS import/export adapter; binary I/O lives in integrations/radio-io.
 */

import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { DM32UV_RADIOFOUNDRY_LIMITS } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import { RT95_LIMITS } from '@core/radios/retevis/rt95/limits.ts';
import type { PowerLadderEntry } from '../../profileLadder.ts';

export interface RadioIoUv5rMiniProfile {
  id: 'radio-io-uv5r-mini';
  label: string;
  /** Binary memory slots (UV-5R Mini channel count). */
  maxMemorySlots: number;
  /** Name bytes in channel record (Mini codec truncates to 12). */
  nameLimit: number;
  powerLadder: readonly PowerLadderEntry[];
}

export interface RadioIoUv21Profile {
  id: 'radio-io-uv21';
  label: string;
  maxMemorySlots: number;
  nameLimit: number;
  powerLadder: readonly PowerLadderEntry[];
}

/** Retevis RT95 VOX Web Serial — mirrors chirp-rt95 caps. */
export type Rt95RadioIoProfileId = 'radio-io-rt95' | 'radio-io-rt95-mm9pdy';

export interface RadioIoRt95Profile {
  id: Rt95RadioIoProfileId;
  label: string;
  maxMemorySlots: number;
  nameLimit: number;
  powerLadder: readonly PowerLadderEntry[];
  /** MM9PDY modded firmware only: zone table caps and the per-channel description length. */
  maxZones?: number;
  zoneMembers?: number;
  zoneNameLimit?: number;
  descriptionLimit?: number;
}

export type Dm32RadioIoProfileId = 'radio-io-dm32uv' | 'radio-io-dm32uv-mm9pdy';

export interface RadioIoDm32uvProfile {
  id: Dm32RadioIoProfileId;
  label: string;
  maxMemorySlots: number;
  nameLimit: number;
  maxZones: number;
  zoneMembers: number;
  /** MM9PDY zone-as-scan has no dedicated scan-list bank. */
  maxScanLists: number | 'not_used';
  scanListMembers: number | 'not_used';
  maxRxGroupLists: number;
  rxGroupListMembers: number;
  maxContacts: number;
  maxTalkGroups: number;
  maxRadioIds: number;
  scanListNameLimit: number;
  rxGroupListNameLimit: number;
  powerLadder: readonly PowerLadderEntry[];
}

export type AtD890RadioIoProfileId = 'radio-io-at-d890uv' | 'radio-io-at-d890uv-mm9pdy';

/** Anytone AT-D890UV Web Serial — stock and MM9PDY share hardware limits. */
export interface RadioIoAtD890uvProfile {
  id: AtD890RadioIoProfileId;
  label: string;
  maxMemorySlots: number;
  nameLimit: number;
  maxZones: number;
  zoneMembers: number;
  /** MM9PDY zone-as-scan has no dedicated scan-list bank. */
  maxScanLists: number | 'not_used';
  scanListMembers: number | 'not_used';
  maxRxGroupLists: number;
  rxGroupListMembers: number;
  maxContacts: number;
  maxTalkGroups: number;
  powerLadder: readonly PowerLadderEntry[];
}

/** OpenGD77 DM-1701 / RT-84 Web Serial — mirrors opengd77-1701 CSV caps. */
export interface RadioIoOpenGd771701Profile {
  id: 'radio-io-opengd77-1701';
  label: string;
  maxMemorySlots: number;
  nameLimit: number;
  maxZones: number;
  zoneMembers: number;
  /** Zone-as-scan-list — no dedicated scan lists. */
  maxScanLists: 'not_used';
  scanListMembers: 'not_used';
  maxRxGroupLists: number;
  rxGroupListMembers: number;
  powerLadder: readonly PowerLadderEntry[];
}

/** OpenGD77 MD-9600 / RT-90 Web Serial — mirrors opengd77-md9600 CSV caps. */
export interface RadioIoOpenGd77Md9600Profile {
  id: 'radio-io-opengd77-md9600';
  label: string;
  maxMemorySlots: number;
  nameLimit: number;
  maxZones: number;
  zoneMembers: number;
  maxScanLists: 'not_used';
  scanListMembers: 'not_used';
  maxRxGroupLists: number;
  rxGroupListMembers: number;
  powerLadder: readonly PowerLadderEntry[];
}

/** DM-32UV RadioFoundry cable write. Caps are the open-firmware codeplug, not stock DM-32. */
export interface RadioIoDm32uvRadioFoundryProfile {
  id: 'radio-io-dm32uv-radiofoundry';
  label: string;
  maxMemorySlots: number;
  nameLimit: number;
  maxZones: number;
  zoneMembers: number;
  maxContacts: number;
  maxRxGroupLists: number;
  rxGroupListMembers: number;
  maxRadioIds: number;
  powerLadder: readonly PowerLadderEntry[];
}

export type RadioIoRadioProfile =
  | RadioIoUv5rMiniProfile
  | RadioIoUv21Profile
  | RadioIoRt95Profile
  | RadioIoDm32uvProfile
  | RadioIoDm32uvRadioFoundryProfile
  | RadioIoAtD890uvProfile
  | RadioIoOpenGd771701Profile
  | RadioIoOpenGd77Md9600Profile;

/** Per-channel description length for profiles that write one (RT95 MM9PDY), else `null`. */
export function radioIoChannelDescriptionLimit(profileId: string): number | null {
  if (!isRt95RadioIoProfileId(profileId)) return null;
  return (getRadioIoProfile(profileId) as RadioIoRt95Profile).descriptionLimit ?? null;
}

/** Stock and MM9PDY RT95 Web Serial profiles share one codec. */
export function isRt95RadioIoProfileId(profileId: string): boolean {
  return profileId === 'radio-io-rt95' || profileId === 'radio-io-rt95-mm9pdy';
}

/** MM9PDY modded firmware: zones and channel descriptions in the MMD1 table. */
export function isMm9pdyRt95RadioIoProfileId(profileId: string): boolean {
  return profileId === 'radio-io-rt95-mm9pdy';
}

/** Stock and MM9PDY DM-32UV Web Serial profiles share one codec. */
export function isDm32RadioIoProfileId(profileId: string): boolean {
  return profileId === 'radio-io-dm32uv' || profileId === 'radio-io-dm32uv-mm9pdy';
}

/** MM9PDY modded firmware — one channel per repeater, zone scan is scan-list id 0. */
export function isMm9pdyDm32RadioIoProfileId(profileId: string): boolean {
  return profileId === 'radio-io-dm32uv-mm9pdy';
}

export function isRadioIoDm32uvProfile(
  profile: RadioIoRadioProfile,
): profile is RadioIoDm32uvProfile {
  return isDm32RadioIoProfileId(profile.id);
}

export function isRadioIoDm32uvRadioFoundryProfile(
  profile: RadioIoRadioProfile,
): profile is RadioIoDm32uvRadioFoundryProfile {
  return profile.id === 'radio-io-dm32uv-radiofoundry';
}

/** Stock and MM9PDY AT-D890UV Web Serial profiles share one codec. */
export function isAtD890RadioIoProfileId(profileId: string): boolean {
  return profileId === 'radio-io-at-d890uv' || profileId === 'radio-io-at-d890uv-mm9pdy';
}

/** MM9PDY modded firmware — one channel per repeater, zone is the scan. */
export function isMm9pdyAtD890RadioIoProfileId(profileId: string): boolean {
  return profileId === 'radio-io-at-d890uv-mm9pdy';
}

export function isRadioIoAtD890uvProfile(
  profile: RadioIoRadioProfile,
): profile is RadioIoAtD890uvProfile {
  return isAtD890RadioIoProfileId(profile.id);
}

export function isRadioIoOpenGd771701Profile(
  profile: RadioIoRadioProfile,
): profile is RadioIoOpenGd771701Profile {
  return profile.id === 'radio-io-opengd77-1701';
}

export function isRadioIoOpenGd77Md9600Profile(
  profile: RadioIoRadioProfile,
): profile is RadioIoOpenGd77Md9600Profile {
  return profile.id === 'radio-io-opengd77-md9600';
}

export function isRadioIoOpenGd77Profile(profile: RadioIoRadioProfile): boolean {
  return isRadioIoOpenGd771701Profile(profile) || isRadioIoOpenGd77Md9600Profile(profile);
}

/** High / Low — UV-17Pro family binary ladder. */
const UV17PRO_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'High', approxWatts: '5 W' },
  { percent: 20, wire: 'Low', approxWatts: '1 W' },
];

/** @deprecated alias */
const UV5R_MINI_POWER_LADDER = UV17PRO_POWER_LADDER;

const DM32_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'High' },
  { percent: 50, wire: 'Middle' },
  { percent: 20, wire: 'Low' },
];

/** Same P1–P9 ladder as opengd77-1701 CSV profile. */
/** Same Low / Mid / High / Turbo ladder as anytone-at-d890uv CSV profile. */
const AT_D890UV_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'Turbo', approxWatts: '7 W VHF / 6 W UHF' },
  { percent: 75, wire: 'High', approxWatts: '5 W' },
  { percent: 50, wire: 'Mid', approxWatts: '2.5 W' },
  { percent: 25, wire: 'Low', approxWatts: '0.2 W' },
];

const OPENGD77_1701_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'P9', approxWatts: '5 W' },
  { percent: 80, wire: 'P8', approxWatts: '4 W' },
  { percent: 60, wire: 'P7', approxWatts: '3 W' },
  { percent: 40, wire: 'P6', approxWatts: '2 W' },
  { percent: 20, wire: 'P5', approxWatts: '1 W' },
  { percent: 15, wire: 'P4', approxWatts: '750 mW' },
  { percent: 10, wire: 'P3', approxWatts: '500 mW' },
  { percent: 5, wire: 'P2', approxWatts: '250 mW' },
  { percent: 1, wire: 'P1', approxWatts: '50 mW' },
];

const OPENGD77_MD9600_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'P9', approxWatts: '40 W' },
  { percent: 63, wire: 'P8', approxWatts: '25 W' },
  { percent: 25, wire: 'P7', approxWatts: '10 W' },
  { percent: 13, wire: 'P6', approxWatts: '5 W' },
  { percent: 5, wire: 'P5', approxWatts: '1 W' },
  { percent: 4, wire: 'P4', approxWatts: '750 mW' },
  { percent: 3, wire: 'P3', approxWatts: '500 mW' },
  { percent: 2, wire: 'P2', approxWatts: '250 mW' },
  { percent: 1, wire: 'P1', approxWatts: '100 mW' },
];

const RT95_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'High', approxWatts: '25 W' },
  { percent: 40, wire: 'Medium', approxWatts: '10 W' },
  { percent: 20, wire: 'Low', approxWatts: '5 W' },
];

export const RADIO_IO_UV5R_MINI_PROFILE: RadioIoUv5rMiniProfile = {
  id: 'radio-io-uv5r-mini',
  label: 'Baofeng UV-5R Mini',
  maxMemorySlots: 999,
  nameLimit: 12,
  powerLadder: UV5R_MINI_POWER_LADDER,
};

export const RADIO_IO_UV21_PROFILE: RadioIoUv21Profile = {
  id: 'radio-io-uv21',
  label: 'Baofeng UV-21Pro V2',
  maxMemorySlots: 1000,
  nameLimit: 12,
  powerLadder: UV17PRO_POWER_LADDER,
};

export const RADIO_IO_RT95_PROFILE: RadioIoRt95Profile = {
  id: 'radio-io-rt95',
  label: 'Retevis RT95 VOX',
  maxMemorySlots: RT95_LIMITS.CHANNEL_MAX,
  nameLimit: RT95_LIMITS.NAME_LENGTH,
  powerLadder: RT95_POWER_LADDER,
};

export const RADIO_IO_RT95_MM9PDY_PROFILE: RadioIoRt95Profile = {
  ...RADIO_IO_RT95_PROFILE,
  id: 'radio-io-rt95-mm9pdy',
  label: 'Retevis RT95 VOX (MM9PDY modded firmware)',
  maxZones: RT95_LIMITS.ZONE_MAX,
  zoneMembers: RT95_LIMITS.ZONE_MEMBERS_MAX,
  zoneNameLimit: RT95_LIMITS.ZONE_NAME_LENGTH,
  descriptionLimit: RT95_LIMITS.DESCRIPTION_LENGTH,
};

export const RADIO_IO_DM32UV_PROFILE: RadioIoDm32uvProfile = {
  id: 'radio-io-dm32uv',
  label: 'Baofeng DM-32UV',
  maxMemorySlots: DM32UV_LIMITS.CHANNEL_MAX,
  nameLimit: DM32UV_LIMITS.NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG,
  maxZones: DM32UV_LIMITS.ZONE_MAX,
  zoneMembers: DM32UV_LIMITS.ZONE_MEMBERS_MAX,
  maxScanLists: DM32UV_LIMITS.SCAN_LISTS_MAX,
  scanListMembers: DM32UV_LIMITS.SCAN_LIST_MEMBERS_MAX,
  maxRxGroupLists: DM32UV_LIMITS.RX_GROUPS_MAX,
  rxGroupListMembers: DM32UV_LIMITS.RX_GROUP_MEMBERS_MAX,
  maxContacts: DM32UV_LIMITS.CONTACTS_MAX,
  maxTalkGroups: DM32UV_LIMITS.TALK_GROUPS_MAX,
  maxRadioIds: DM32UV_LIMITS.RADIO_IDS_MAX,
  scanListNameLimit: DM32UV_LIMITS.NAME_LENGTH_SCAN_LIST,
  rxGroupListNameLimit: DM32UV_LIMITS.NAME_LENGTH_RX_GROUP_LIST,
  powerLadder: DM32_POWER_LADDER,
};

/** Same hardware caps as stock. Scan lists are unused — the zone is the scan. */
export const RADIO_IO_DM32UV_MM9PDY_PROFILE: RadioIoDm32uvProfile = {
  ...RADIO_IO_DM32UV_PROFILE,
  id: 'radio-io-dm32uv-mm9pdy',
  label: 'Baofeng DM-32UV (MM9PDY modded firmware)',
  maxScanLists: 'not_used',
  scanListMembers: 'not_used',
};

export const RADIO_IO_AT_D890UV_PROFILE: RadioIoAtD890uvProfile = {
  id: 'radio-io-at-d890uv',
  label: 'Anytone AT-D890UV',
  maxMemorySlots: AT_D890UV_LIMITS.CHANNEL_MAX,
  nameLimit: AT_D890UV_LIMITS.NAME_LENGTH,
  maxZones: AT_D890UV_LIMITS.ZONE_MAX,
  zoneMembers: AT_D890UV_LIMITS.ZONE_MEMBERS_MAX,
  maxScanLists: AT_D890UV_LIMITS.SCAN_LISTS_MAX,
  scanListMembers: AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX,
  maxRxGroupLists: AT_D890UV_LIMITS.RX_GROUP_LISTS_MAX,
  rxGroupListMembers: AT_D890UV_LIMITS.RX_GROUP_MEMBERS_MAX,
  maxContacts: AT_D890UV_LIMITS.DIGITAL_CONTACTS_MAX,
  maxTalkGroups: AT_D890UV_LIMITS.TALK_GROUPS_MAX,
  powerLadder: AT_D890UV_POWER_LADDER,
};

/** Same hardware caps as stock. Scan lists are unused — the zone is the scan. */
export const RADIO_IO_AT_D890UV_MM9PDY_PROFILE: RadioIoAtD890uvProfile = {
  ...RADIO_IO_AT_D890UV_PROFILE,
  id: 'radio-io-at-d890uv-mm9pdy',
  label: 'Anytone AT-D890UV (MM9PDY modded firmware)',
  maxScanLists: 'not_used',
  scanListMembers: 'not_used',
};

export const RADIO_IO_OPENGD77_1701_PROFILE: RadioIoOpenGd771701Profile = {
  id: 'radio-io-opengd77-1701',
  label: 'Baofeng DM-1701 / RT-84 (OpenGD77)',
  maxMemorySlots: OPENGD77_FAMILY_LIMITS.CHANNEL_MAX,
  nameLimit: OPENGD77_FAMILY_LIMITS.NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG,
  maxZones: OPENGD77_FAMILY_LIMITS.ZONE_MAX,
  zoneMembers: OPENGD77_FAMILY_LIMITS.ZONE_MEMBERS_MAX,
  maxScanLists: 'not_used',
  scanListMembers: 'not_used',
  maxRxGroupLists: OPENGD77_FAMILY_LIMITS.RX_GROUP_LISTS_MAX,
  rxGroupListMembers: OPENGD77_FAMILY_LIMITS.RX_GROUP_MEMBERS_MAX,
  powerLadder: OPENGD77_1701_POWER_LADDER,
};

/** Nine steps, same percent split as the RadioFoundry codeplug file. Watts are unmeasured. */
const DM32_RADIOFOUNDRY_POWER_LADDER: readonly PowerLadderEntry[] = Array.from(
  { length: DM32UV_RADIOFOUNDRY_LIMITS.POWER_LEVELS },
  (_, index) => ({
    percent:
      index === DM32UV_RADIOFOUNDRY_LIMITS.POWER_LEVELS - 1
        ? 100
        : Math.floor((index * 100) / DM32UV_RADIOFOUNDRY_LIMITS.POWER_LEVELS) + 1,
    wire: String(index + 1),
  }),
);

export const RADIO_IO_DM32UV_RADIOFOUNDRY_PROFILE: RadioIoDm32uvRadioFoundryProfile = {
  id: 'radio-io-dm32uv-radiofoundry',
  label: 'Baofeng DM-32UV (RadioFoundry)',
  maxMemorySlots: DM32UV_RADIOFOUNDRY_LIMITS.CHANNEL_MAX,
  nameLimit: DM32UV_RADIOFOUNDRY_LIMITS.NAME_MAX,
  maxZones: DM32UV_RADIOFOUNDRY_LIMITS.ZONE_MAX,
  zoneMembers: DM32UV_RADIOFOUNDRY_LIMITS.ZONE_MEMBERS_MAX,
  maxContacts: DM32UV_RADIOFOUNDRY_LIMITS.CONTACTS_MAX,
  maxRxGroupLists: DM32UV_RADIOFOUNDRY_LIMITS.RX_GROUPS_MAX,
  rxGroupListMembers: DM32UV_RADIOFOUNDRY_LIMITS.RX_GROUP_MEMBERS_MAX,
  maxRadioIds: DM32UV_RADIOFOUNDRY_LIMITS.RADIO_IDS_MAX,
  powerLadder: DM32_RADIOFOUNDRY_POWER_LADDER,
};

export const RADIO_IO_OPENGD77_MD9600_PROFILE: RadioIoOpenGd77Md9600Profile = {
  id: 'radio-io-opengd77-md9600',
  label: 'TYT MD-9600 / RT-90 (OpenGD77)',
  maxMemorySlots: OPENGD77_FAMILY_LIMITS.CHANNEL_MAX,
  nameLimit: OPENGD77_FAMILY_LIMITS.NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG,
  maxZones: OPENGD77_FAMILY_LIMITS.ZONE_MAX,
  zoneMembers: OPENGD77_FAMILY_LIMITS.ZONE_MEMBERS_MAX,
  maxScanLists: 'not_used',
  scanListMembers: 'not_used',
  maxRxGroupLists: OPENGD77_FAMILY_LIMITS.RX_GROUP_LISTS_MAX,
  rxGroupListMembers: OPENGD77_FAMILY_LIMITS.RX_GROUP_MEMBERS_MAX,
  powerLadder: OPENGD77_MD9600_POWER_LADDER,
};

export const RADIO_IO_PROFILES: readonly RadioIoRadioProfile[] = [
  RADIO_IO_UV5R_MINI_PROFILE,
  RADIO_IO_UV21_PROFILE,
  RADIO_IO_RT95_PROFILE,
  RADIO_IO_RT95_MM9PDY_PROFILE,
  RADIO_IO_DM32UV_PROFILE,
  RADIO_IO_DM32UV_MM9PDY_PROFILE,
  RADIO_IO_AT_D890UV_PROFILE,
  RADIO_IO_AT_D890UV_MM9PDY_PROFILE,
  RADIO_IO_OPENGD77_1701_PROFILE,
  RADIO_IO_OPENGD77_MD9600_PROFILE,
  RADIO_IO_DM32UV_RADIOFOUNDRY_PROFILE,
];

export function getRadioIoProfile(profileId: string): RadioIoRadioProfile {
  const found = RADIO_IO_PROFILES.find((p) => p.id === profileId);
  if (!found) throw new Error(`Unknown Direct radio profile: ${profileId}`);
  return found;
}

export function radioIoNameLimit(profileId: string): number {
  return getRadioIoProfile(profileId).nameLimit;
}

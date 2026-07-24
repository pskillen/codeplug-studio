/**
 * Direct-radio (Web Serial) profiles — wire limits for UI / assemble boundary.
 * No CPS import/export adapter; binary I/O lives in integrations/radio-io.
 */

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

export interface RadioIoDm32uvProfile {
  id: 'radio-io-dm32uv';
  label: string;
  maxMemorySlots: number;
  nameLimit: number;
  maxZones: number;
  zoneMembers: number;
  maxScanLists: number;
  scanListMembers: number;
  maxRxGroupLists: number;
  rxGroupListMembers: number;
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

export type RadioIoRadioProfile =
  | RadioIoUv5rMiniProfile
  | RadioIoDm32uvProfile
  | RadioIoOpenGd771701Profile;

export function isRadioIoDm32uvProfile(
  profile: RadioIoRadioProfile,
): profile is RadioIoDm32uvProfile {
  return profile.id === 'radio-io-dm32uv';
}

export function isRadioIoOpenGd771701Profile(
  profile: RadioIoRadioProfile,
): profile is RadioIoOpenGd771701Profile {
  return profile.id === 'radio-io-opengd77-1701';
}

/** High / Low — same facts as NeonPlug UV-5R Mini binary. */
const UV5R_MINI_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'High', approxWatts: '5 W' },
  { percent: 20, wire: 'Low', approxWatts: '1 W' },
];

const DM32_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'High' },
  { percent: 50, wire: 'Middle' },
  { percent: 20, wire: 'Low' },
];

/** Same P1–P9 ladder as opengd77-1701 CSV profile. */
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

export const RADIO_IO_UV5R_MINI_PROFILE: RadioIoUv5rMiniProfile = {
  id: 'radio-io-uv5r-mini',
  label: 'Baofeng UV-5R Mini',
  maxMemorySlots: 999,
  nameLimit: 12,
  powerLadder: UV5R_MINI_POWER_LADDER,
};

export const RADIO_IO_DM32UV_PROFILE: RadioIoDm32uvProfile = {
  id: 'radio-io-dm32uv',
  label: 'Baofeng DM-32UV',
  maxMemorySlots: 4000,
  nameLimit: 16,
  maxZones: 250,
  zoneMembers: 64,
  maxScanLists: 32,
  scanListMembers: 15,
  maxRxGroupLists: 250,
  rxGroupListMembers: 32,
  powerLadder: DM32_POWER_LADDER,
};

export const RADIO_IO_OPENGD77_1701_PROFILE: RadioIoOpenGd771701Profile = {
  id: 'radio-io-opengd77-1701',
  label: 'Baofeng DM-1701 / RT-84 (OpenGD77)',
  maxMemorySlots: 1023,
  nameLimit: 16,
  maxZones: 68,
  zoneMembers: 80,
  maxScanLists: 'not_used',
  scanListMembers: 'not_used',
  maxRxGroupLists: 76,
  rxGroupListMembers: 32,
  powerLadder: OPENGD77_1701_POWER_LADDER,
};

export const RADIO_IO_PROFILES: readonly RadioIoRadioProfile[] = [
  RADIO_IO_UV5R_MINI_PROFILE,
  RADIO_IO_DM32UV_PROFILE,
  RADIO_IO_OPENGD77_1701_PROFILE,
];

export function getRadioIoProfile(profileId: string): RadioIoRadioProfile {
  const found = RADIO_IO_PROFILES.find((p) => p.id === profileId);
  if (!found) throw new Error(`Unknown Direct radio profile: ${profileId}`);
  return found;
}

export function radioIoNameLimit(profileId: string): number {
  return getRadioIoProfile(profileId).nameLimit;
}

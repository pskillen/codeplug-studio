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

export type RadioIoRadioProfile = RadioIoUv5rMiniProfile | RadioIoDm32uvProfile;

export function isRadioIoDm32uvProfile(
  profile: RadioIoRadioProfile,
): profile is RadioIoDm32uvProfile {
  return profile.id === 'radio-io-dm32uv';
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

export const RADIO_IO_PROFILES: readonly RadioIoRadioProfile[] = [
  RADIO_IO_UV5R_MINI_PROFILE,
  RADIO_IO_DM32UV_PROFILE,
];

export function getRadioIoProfile(profileId: string): RadioIoRadioProfile {
  const found = RADIO_IO_PROFILES.find((p) => p.id === profileId);
  if (!found) throw new Error(`Unknown Direct radio profile: ${profileId}`);
  return found;
}

export function radioIoNameLimit(profileId: string): number {
  return getRadioIoProfile(profileId).nameLimit;
}

/** CHIRP radio profiles — import/export boundary (memory limits + power ladder). */

import { percentToWire, wireToPercent, type PowerLadderEntry } from '../../profileLadder.ts';

export interface ChirpRadioProfile {
  id: string;
  label: string;
  defaultFileName: string;
  maxMemorySlots: number;
  /** Default max channel wire name length (radio LCD limit). */
  nameLimit: number;
  /** High/default first — used when power is null. */
  powerLadder: readonly PowerLadderEntry[];
}

const UV5R_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: '5.0W', approxWatts: '5 W' },
  { percent: 20, wire: '1.0W', approxWatts: '1 W' },
];

const UV21_LADDER: readonly PowerLadderEntry[] = [
  { percent: 83, wire: '5.0W', approxWatts: '5 W' },
  { percent: 17, wire: '1.0W', approxWatts: '1 W' },
];

const RT95_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: '25W', approxWatts: '25 W' },
  { percent: 40, wire: '10W', approxWatts: '10 W' },
];

export const CHIRP_PROFILES: readonly ChirpRadioProfile[] = [
  {
    id: 'chirp-uv5r',
    label: 'Baofeng UV-5R Mini',
    defaultFileName: 'Baofeng_UV-5R Mini_export.csv',
    maxMemorySlots: 999,
    nameLimit: 12,
    powerLadder: UV5R_LADDER,
  },
  {
    id: 'chirp-uv21',
    label: 'Baofeng UV-21Pro V2',
    defaultFileName: 'Baofeng_UV-21ProV2_export.csv',
    maxMemorySlots: 128,
    nameLimit: 16,
    powerLadder: UV21_LADDER,
  },
  {
    id: 'chirp-rt95',
    label: 'Retevis RT95 VOX',
    defaultFileName: 'Retevis_RT95 VOX_export.csv',
    maxMemorySlots: 128,
    nameLimit: 16,
    powerLadder: RT95_LADDER,
  },
] as const;

export const DEFAULT_CHIRP_PROFILE_ID = CHIRP_PROFILES[0]!.id;

export function getChirpProfile(profileId: string): ChirpRadioProfile {
  const found = CHIRP_PROFILES.find((p) => p.id === profileId);
  if (!found) throw new Error(`Unknown CHIRP profile: ${profileId}`);
  return found;
}

export function chirpWireToPercent(profileId: string, wire: string): number | null {
  return wireToPercent(getChirpProfile(profileId), wire);
}

export function chirpPercentToWire(profileId: string, percent: number | null): string {
  return percentToWire(getChirpProfile(profileId), percent);
}

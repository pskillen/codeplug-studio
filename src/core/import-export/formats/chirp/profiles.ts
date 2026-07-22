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

/** UV-17Pro family High 5 W / Low 1 W — CHIRP `PowerLevel` labels High/Low; CSV uses watt strings. */
const UV17PRO_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: '5.0W', approxWatts: '5 W' },
  { percent: 20, wire: '1.0W', approxWatts: '1 W' },
];

/**
 * RT95 VOX — CHIRP `POWER_LEVELS` Low/Medium/High at ~5/10/25 W (`anytone778uv.py`).
 * Studio exports Generic CSV watt strings (fixtures + `parse_power`).
 */
const RT95_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: '25W', approxWatts: '25 W' },
  { percent: 40, wire: '10W', approxWatts: '10 W' },
  { percent: 20, wire: '5.0W', approxWatts: '5 W' },
];

export const CHIRP_PROFILES: readonly ChirpRadioProfile[] = [
  {
    id: 'chirp-uv5r',
    label: 'Baofeng UV-5R Mini',
    defaultFileName: 'Baofeng_UV-5R Mini_export.csv',
    /** CHIRP `UV5RMini.CHANNELS` */
    maxMemorySlots: 999,
    /** CHIRP UV17Pro `LENGTH_NAME` */
    nameLimit: 12,
    powerLadder: UV17PRO_LADDER,
  },
  {
    id: 'chirp-uv21',
    label: 'Baofeng UV-21Pro V2',
    defaultFileName: 'Baofeng_UV-21ProV2_export.csv',
    /** CHIRP `UV17Pro.CHANNELS` (UV21ProV2 inherits) */
    maxMemorySlots: 1000,
    nameLimit: 12,
    powerLadder: UV17PRO_LADDER,
  },
  {
    id: 'chirp-rt95',
    label: 'Retevis RT95 VOX',
    defaultFileName: 'Retevis_RT95 VOX_export.csv',
    /** CHIRP `memory_bounds` (1, 200) */
    maxMemorySlots: 200,
    /** CHIRP `AnyTone778UVvoxBase.NAME_LENGTH` */
    nameLimit: 6,
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

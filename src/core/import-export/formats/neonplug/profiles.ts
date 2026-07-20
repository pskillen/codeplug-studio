/**
 * NeonPlug radio profiles — import/export boundary only.
 * Channel + org export (#539/#540). UV5R polish: #541.
 *
 * Keep `neonplug-dm32uv` numeric caps in sync with `dm32-baofeng-dm32uv` — see profiles.test.ts.
 */

import { percentToWire, wireToPercent, type PowerLadderEntry } from '../../profileLadder.ts';

export interface NeonplugDm32uvRadioProfile {
  id: 'neonplug-dm32uv';
  label: string;
  maxChannels: number;
  maxZones: number;
  /** Max expanded channel members per zone (NeonPlug ZONE_CHANNELS_MAX). */
  zoneMembers: number;
  maxScanLists: number;
  /** Named scan-list members (zone→scan truncate still uses this). */
  scanListMembers: number;
  maxRxGroupLists: number;
  rxGroupListMembers: number;
  maxContacts: number;
  maxTalkGroups: number;
  /** Channel / zone / contact / talk-group wire name length. */
  nameLimit: number;
  scanListNameLimit: number;
  rxGroupListNameLimit: number;
  powerLadder: readonly PowerLadderEntry[];
  squelchLadder: readonly PowerLadderEntry[];
}

export interface NeonplugUv5rminiRadioProfile {
  id: 'neonplug-uv5rmini';
  label: string;
  defaultFileName: string;
  /** NeonPlug binary memory slots (BAOFENG_CHANNEL_COUNT) — not CHIRP CSV 128. */
  maxMemorySlots: number;
  /** NeonPlug UV5R write slices name to 12 bytes — not CHIRP CSV 7. */
  nameLimit: number;
  powerLadder: readonly PowerLadderEntry[];
}

export type NeonplugRadioProfile = NeonplugDm32uvRadioProfile | NeonplugUv5rminiRadioProfile;

const DM32_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'High' },
  { percent: 50, wire: 'Middle' },
  { percent: 20, wire: 'Low' },
];

const DM32_SQUELCH_LADDER: readonly PowerLadderEntry[] = Array.from({ length: 10 }, (_, level) => ({
  wire: String(level),
  percent: Math.round((level * 100) / 9),
}));

const UV5R_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'High', approxWatts: '5 W' },
  { percent: 20, wire: 'Low', approxWatts: '1 W' },
];

/** Keep numeric caps identical to `dm32-baofeng-dm32uv` (see sync test). */
export const NEONPLUG_DM32UV_PROFILE: NeonplugDm32uvRadioProfile = {
  id: 'neonplug-dm32uv',
  label: 'Baofeng DM-32UV (NeonPlug)',
  maxChannels: 4000,
  maxZones: 250,
  zoneMembers: 64,
  maxScanLists: 32,
  scanListMembers: 15,
  maxRxGroupLists: 32,
  rxGroupListMembers: 32,
  maxContacts: 250,
  maxTalkGroups: 800,
  nameLimit: 16,
  scanListNameLimit: 10,
  rxGroupListNameLimit: 10,
  powerLadder: DM32_POWER_LADDER,
  squelchLadder: DM32_SQUELCH_LADDER,
};

export const NEONPLUG_UV5RMINI_PROFILE: NeonplugUv5rminiRadioProfile = {
  id: 'neonplug-uv5rmini',
  label: 'Baofeng UV-5R Mini (NeonPlug)',
  defaultFileName: 'Baofeng_UV5R-Mini_export.neonplug',
  maxMemorySlots: 999,
  nameLimit: 12,
  powerLadder: UV5R_LADDER,
};

export const NEONPLUG_PROFILES: readonly NeonplugRadioProfile[] = [
  NEONPLUG_DM32UV_PROFILE,
  NEONPLUG_UV5RMINI_PROFILE,
] as const;

export const DEFAULT_NEONPLUG_PROFILE_ID = NEONPLUG_DM32UV_PROFILE.id;

export function getNeonplugProfile(profileId: string): NeonplugRadioProfile {
  const found = NEONPLUG_PROFILES.find((p) => p.id === profileId);
  if (!found) throw new Error(`Unknown NeonPlug profile: ${profileId}`);
  return found;
}

export function isNeonplugDm32uvProfile(
  profile: NeonplugRadioProfile,
): profile is NeonplugDm32uvRadioProfile {
  return profile.id === 'neonplug-dm32uv';
}

export function neonplugNameLimit(profileId: string): number {
  return getNeonplugProfile(profileId).nameLimit;
}

export function neonplugWireToPercent(profileId: string, wire: string): number | null {
  return wireToPercent(getNeonplugProfile(profileId), wire.trim());
}

export function neonplugPercentToWire(profileId: string, percent: number | null): string {
  return percentToWire(getNeonplugProfile(profileId), percent);
}

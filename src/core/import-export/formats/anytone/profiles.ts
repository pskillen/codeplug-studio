/** Anytone radio profiles — import/export boundary (caps + power ladder). */

import { percentToWire, wireToPercent, type PowerLadderEntry } from '../../profileLadder.ts';

export interface AnytoneRadioProfile {
  id: string;
  label: string;
  /** Provisional — verify against CPS manual. */
  maxChannels: number;
  zoneMembers: number;
  scanListMembers: number;
  rxGroupListMembers: number;
  nameLimit: number;
  powerLadder: readonly PowerLadderEntry[];
  /** Default DMR radio ID label when channel omits one. */
  defaultRadioIdLabel: string;
  defaultRadioId: string;
}

const AT_D890UV_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'High' },
  { percent: 25, wire: 'Low' },
];

export const ANYTONE_PROFILES: readonly AnytoneRadioProfile[] = [
  {
    id: 'anytone-at-d890uv',
    label: 'Anytone AT-D890UV',
    maxChannels: 4000,
    zoneMembers: 64,
    scanListMembers: 64,
    rxGroupListMembers: 32,
    nameLimit: 16,
    powerLadder: AT_D890UV_POWER_LADDER,
    defaultRadioIdLabel: 'TEST01',
    defaultRadioId: '1234567',
  },
] as const;

export const DEFAULT_ANYTONE_PROFILE_ID = ANYTONE_PROFILES[0]!.id;

export function getAnytoneProfile(profileId: string): AnytoneRadioProfile {
  const found = ANYTONE_PROFILES.find((p) => p.id === profileId);
  if (!found) throw new Error(`Unknown Anytone profile: ${profileId}`);
  return found;
}

export function anytoneWireToPercent(profileId: string, wire: string): number | null {
  return wireToPercent(getAnytoneProfile(profileId), wire.trim());
}

export function anytonePercentToWire(profileId: string, percent: number | null): string {
  return percentToWire(getAnytoneProfile(profileId), percent);
}

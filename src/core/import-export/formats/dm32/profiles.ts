/** Baofeng DM32 radio profiles — import/export boundary. */

import { percentToWire, wireToPercent, type PowerLadderEntry } from '../../profileLadder.ts';

export interface Dm32RadioProfile {
  id: string;
  label: string;
  maxChannels: number;
  maxZones: number;
  /** Max expanded channel members per zone (radio / NeonPlug ZONE_CHANNELS_MAX). */
  zoneMembers: number;
  maxScanLists: number;
  /** Named CSV members; CPS “16” includes an implicit current-channel slot. */
  scanListMembers: number;
  maxRxGroupLists: number;
  rxGroupListMembers: number;
  maxContacts: number;
  maxTalkGroups: number;
  /** Default max channel / zone / contact / talk-group wire name length (LCD limit). */
  nameLimit: number;
  /**
   * Max `Scan.csv` Scan Name length (stricter than `nameLimit`).
   * Conservative 10 (CPS official 11; NeonPlug radio field is 10).
   */
  scanListNameLimit: number;
  /** Max `RXGroupLists.csv` name length (NeonPlug RXGroup: 11 bytes null-terminated). */
  rxGroupListNameLimit: number;
  powerLadder: readonly PowerLadderEntry[];
  squelchLadder: readonly PowerLadderEntry[];
  /** Lossy default for channel `DMR ID` column on export. */
  defaultDmrIdLabel: string;
}

const DM32_POWER_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'High' },
  { percent: 50, wire: 'Middle' },
  { percent: 20, wire: 'Low' },
];

const DM32_SQUELCH_LADDER: readonly PowerLadderEntry[] = Array.from({ length: 10 }, (_, level) => ({
  wire: String(level),
  percent: Math.round((level * 100) / 9),
}));

export const DM32_PROFILES: readonly Dm32RadioProfile[] = [
  {
    id: 'dm32-baofeng-dm32uv',
    label: 'Baofeng DM-32UV',
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
    defaultDmrIdLabel: 'Paddy MM7IGV',
  },
] as const;

export const DEFAULT_DM32_PROFILE_ID = DM32_PROFILES[0]!.id;

export function getDm32Profile(profileId: string): Dm32RadioProfile {
  const found = DM32_PROFILES.find((p) => p.id === profileId);
  if (!found) throw new Error(`Unknown DM32 profile: ${profileId}`);
  return found;
}

export function dm32WireToPercent(profileId: string, wire: string): number | null {
  return wireToPercent(getDm32Profile(profileId), wire.trim());
}

export function dm32PercentToWire(profileId: string, percent: number | null): string {
  return percentToWire(getDm32Profile(profileId), percent);
}

export function dm32SquelchWireToPercent(profileId: string, wire: string): number | null {
  const trimmed = wire.trim();
  if (!trimmed) return null;
  return wireToPercent({ powerLadder: getDm32Profile(profileId).squelchLadder }, trimmed);
}

export function dm32PercentToSquelchWire(profileId: string, percent: number | null): string {
  return percentToWire({ powerLadder: getDm32Profile(profileId).squelchLadder }, percent);
}

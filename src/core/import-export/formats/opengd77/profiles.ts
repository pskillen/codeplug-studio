/** OpenGD77 radio profiles — import/export boundary (cardinality + power ladder). */

import { percentToWire, wireToPercent, type PowerLadderEntry } from '../../profileLadder.ts';

export interface OpenGd77RadioProfile {
  id: string;
  label: string;
  maxChannels: number;
  zoneMembers: number;
  tgListMembers: number;
  /** Default max channel wire name length (LCD limit). */
  nameLimit: number;
  /** High/default first — P-index wire strings. */
  powerLadder: readonly PowerLadderEntry[];
}

const OPENGD77_1701_LADDER: readonly PowerLadderEntry[] = [
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

/** Provisional — confirm against CPS export. */
const OPENGD77_MD9600_LADDER: readonly PowerLadderEntry[] = [
  { percent: 100, wire: 'P8', approxWatts: '40–50 W' },
  { percent: 60, wire: 'P7', approxWatts: '25 W' },
  { percent: 40, wire: 'P6', approxWatts: '10 W' },
  { percent: 20, wire: 'P5', approxWatts: '5 W' },
  { percent: 8, wire: 'P4', approxWatts: '2 W' },
  { percent: 4, wire: 'P3', approxWatts: '1 W' },
  { percent: 2, wire: 'P2', approxWatts: '500 mW' },
  { percent: 1, wire: 'P1', approxWatts: '100 mW' },
];

export const OPENGD77_PROFILES: readonly OpenGd77RadioProfile[] = [
  {
    id: 'opengd77-1701',
    label: 'Baofeng 1701 / Retevis RT-84',
    maxChannels: 1023,
    zoneMembers: 80,
    tgListMembers: 32,
    nameLimit: 16,
    powerLadder: OPENGD77_1701_LADDER,
  },
  {
    id: 'opengd77-md9600',
    label: 'TYT MD-9600 / Retevis RT-90',
    maxChannels: 1023,
    zoneMembers: 80,
    tgListMembers: 32,
    nameLimit: 16,
    powerLadder: OPENGD77_MD9600_LADDER,
  },
] as const;

export const DEFAULT_OPENGD77_PROFILE_ID = OPENGD77_PROFILES[0]!.id;

export function getOpenGd77Profile(profileId: string): OpenGd77RadioProfile {
  const found = OPENGD77_PROFILES.find((p) => p.id === profileId);
  if (!found) throw new Error(`Unknown OpenGD77 profile: ${profileId}`);
  return found;
}

export function opengd77ProfileSelectData(): { value: string; label: string }[] {
  return OPENGD77_PROFILES.map((p) => ({ value: p.id, label: p.label }));
}

export function opengd77WireToPercent(profileId: string, wire: string): number | null {
  const trimmed = wire.trim();
  if (!trimmed || trimmed.toLowerCase() === 'master') return null;
  const fromLadder = wireToPercent(getOpenGd77Profile(profileId), trimmed);
  if (fromLadder != null) return fromLadder;
  const match = /^P(\d+)$/i.exec(trimmed);
  if (match) {
    const n = parseInt(match[1], 10);
    const entry = getOpenGd77Profile(profileId).powerLadder.find(
      (e) => e.wire.toUpperCase() === `P${n}`,
    );
    if (entry) return entry.percent;
  }
  return null;
}

export function opengd77PercentToWire(profileId: string, percent: number | null): string {
  if (percent == null) return 'Master';
  return percentToWire(getOpenGd77Profile(profileId), percent);
}

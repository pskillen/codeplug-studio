/**
 * App-facing power ladder display projection — import/export boundary only.
 * Does not mutate library Channel.power; informational watts/wire labels for UI.
 */

import type { FormatId } from './types.ts';
import { formatCatalog } from './registry.ts';
import { getFormatProfiles } from './formatProfiles.ts';
import { nearestLadderEntry } from './profileLadder.ts';
import {
  getOpenGd77Profile,
  opengd77PercentToWire,
} from './formats/opengd77/profiles.ts';
import { getDm32Profile, dm32PercentToWire } from './formats/dm32/profiles.ts';
import { getChirpProfile, chirpPercentToWire } from './formats/chirp/profiles.ts';
import { getAnytoneProfile, anytonePercentToWire } from './formats/anytone/profiles.ts';

export interface PowerLadderProfileKey {
  formatId: FormatId;
  profileId: string;
}

export interface PowerLadderHintRow {
  formatId: FormatId;
  profileId: string;
  label: string;
  /** CPS wire label for the nearest ladder step (or Master for OpenGD77 null). */
  wire: string;
  /** Optional approximate watts from profile metadata. */
  approxWatts?: string;
  /** True when `power` is null (radio-default export path). */
  isRadioDefault: boolean;
}

const FORMATS_WITH_POWER_LADDERS: readonly FormatId[] = [
  'opengd77',
  'dm32',
  'chirp',
  'anytone',
];

/** All shipped CPS profiles that expose a power ladder. */
export function listShippedPowerLadderProfiles(): PowerLadderProfileKey[] {
  const keys: PowerLadderProfileKey[] = [];
  for (const formatId of FORMATS_WITH_POWER_LADDERS) {
    const entry = formatCatalog.find((f) => f.id === formatId);
    if (entry?.exportStatus !== 'shipped') continue;
    for (const profile of getFormatProfiles(formatId)) {
      keys.push({ formatId, profileId: profile.profileId });
    }
  }
  return keys;
}

/**
 * Unique profile keys from builds, preserving first-seen order.
 * Falls back to all shipped ladders when `buildProfiles` is empty.
 */
export function resolvePowerLadderProfileKeys(
  buildProfiles: readonly PowerLadderProfileKey[],
): PowerLadderProfileKey[] {
  if (buildProfiles.length === 0) return listShippedPowerLadderProfiles();
  const seen = new Set<string>();
  const unique: PowerLadderProfileKey[] = [];
  for (const key of buildProfiles) {
    const id = `${key.formatId}:${key.profileId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(key);
  }
  return unique;
}

function hintForProfile(
  formatId: FormatId,
  profileId: string,
  power: number | null,
): PowerLadderHintRow | null {
  try {
    if (formatId === 'opengd77') {
      const profile = getOpenGd77Profile(profileId);
      if (power == null) {
        return {
          formatId,
          profileId,
          label: profile.label,
          wire: 'Master',
          approxWatts: 'radio default',
          isRadioDefault: true,
        };
      }
      const wire = opengd77PercentToWire(profileId, power);
      const entry = nearestLadderEntry(profile, power);
      return {
        formatId,
        profileId,
        label: profile.label,
        wire,
        approxWatts: entry?.approxWatts,
        isRadioDefault: false,
      };
    }
    if (formatId === 'dm32') {
      const profile = getDm32Profile(profileId);
      const wire = dm32PercentToWire(profileId, power);
      const entry = nearestLadderEntry(profile, power);
      return {
        formatId,
        profileId,
        label: profile.label,
        wire,
        approxWatts: entry?.approxWatts,
        isRadioDefault: power == null,
      };
    }
    if (formatId === 'chirp') {
      const profile = getChirpProfile(profileId);
      const wire = chirpPercentToWire(profileId, power);
      const entry = nearestLadderEntry(profile, power);
      return {
        formatId,
        profileId,
        label: profile.label,
        wire,
        approxWatts: entry?.approxWatts,
        isRadioDefault: power == null,
      };
    }
    if (formatId === 'anytone') {
      const profile = getAnytoneProfile(profileId);
      const wire = anytonePercentToWire(profileId, power);
      const entry = nearestLadderEntry(profile, power);
      return {
        formatId,
        profileId,
        label: profile.label,
        wire,
        approxWatts: entry?.approxWatts,
        isRadioDefault: power == null,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Informational projection of `power` percent (or null) onto export profile ladders.
 * Does not change export behaviour — for Channel edit UI only.
 */
export function listPowerLadderHints(
  power: number | null,
  buildProfiles: readonly PowerLadderProfileKey[] = [],
): PowerLadderHintRow[] {
  const keys = resolvePowerLadderProfileKeys(buildProfiles);
  const rows: PowerLadderHintRow[] = [];
  for (const key of keys) {
    const row = hintForProfile(key.formatId, key.profileId, power);
    if (row) rows.push(row);
  }
  return rows;
}

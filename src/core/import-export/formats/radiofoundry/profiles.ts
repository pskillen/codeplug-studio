/** RadioFoundry codeplug profiles — export boundary only. */

import { DM32UV_RADIOFOUNDRY_BOARD } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import {
  RADIOFOUNDRY_LIMITS,
  type RadioFoundryBoardLimits,
} from '@core/radios/radiofoundry/limits.ts';
import type { PowerLadderEntry } from '../../profileLadder.ts';
import { RADIOFOUNDRY_CODEPLUG_FILE_NAME } from './layout.ts';
import { radioFoundryLevelToByte } from './power.ts';

export interface RadioFoundryRadioProfile {
  id: string;
  label: string;
  defaultFileName: string;
  maxChannels: number;
  maxZones: number;
  zoneMembers: number;
  maxContacts: number;
  maxRxGroupLists: number;
  rxGroupListMembers: number;
  nameLimit: number;
  radioNameLimit: number;
  maxRadioIds: number;
  dmrIdMax: number;
  powerLevels: number;
  /** The cable write's radio-io profile for the same radio. */
  radioIoProfileId: string;
  /** Board facts: bands, power steps, ID database, physical base, image end. */
  board: RadioFoundryBoardLimits;
  /**
   * Nine steps, no watt labels. The encoder maps percent with equal steps
   * (`radioFoundryPowerByte`), not nearest-ladder lookup. Watts are unmeasured.
   */
  powerLadder: readonly PowerLadderEntry[];
}

/**
 * Equal percent steps; wire is the byte each level writes (power.ts). `labels` fills `approxWatts`
 * per level, lowest first. Shared by the codeplug file and the cable write.
 */
export function radioFoundryPowerLadder(
  powerLevels: number,
  labels?: readonly string[],
): readonly PowerLadderEntry[] {
  if (labels && labels.length !== powerLevels) {
    throw new Error(
      `RadioFoundry power labels: expected ${powerLevels} entries, got ${labels.length}`,
    );
  }
  return Array.from({ length: powerLevels }, (_, index) => ({
    percent: index === powerLevels - 1 ? 100 : Math.floor((index * 100) / powerLevels) + 1,
    wire: String(radioFoundryLevelToByte(index, powerLevels)),
    ...(labels ? { approxWatts: labels[index]! } : {}),
  }));
}

/** A RadioFoundry codec profile: firmware-wide counts plus one board. */
export function radioFoundryCodecProfile(
  id: string,
  radioIoProfileId: string,
  board: RadioFoundryBoardLimits,
): RadioFoundryRadioProfile {
  return {
    id,
    label: 'RadioFoundry codeplug',
    defaultFileName: RADIOFOUNDRY_CODEPLUG_FILE_NAME,
    maxChannels: RADIOFOUNDRY_LIMITS.CHANNEL_MAX,
    maxZones: RADIOFOUNDRY_LIMITS.ZONE_MAX,
    zoneMembers: RADIOFOUNDRY_LIMITS.ZONE_MEMBERS_MAX,
    maxContacts: RADIOFOUNDRY_LIMITS.CONTACTS_MAX,
    maxRxGroupLists: RADIOFOUNDRY_LIMITS.RX_GROUPS_MAX,
    rxGroupListMembers: RADIOFOUNDRY_LIMITS.RX_GROUP_MEMBERS_MAX,
    nameLimit: RADIOFOUNDRY_LIMITS.NAME_MAX,
    radioNameLimit: RADIOFOUNDRY_LIMITS.RADIO_NAME_MAX,
    maxRadioIds: RADIOFOUNDRY_LIMITS.RADIO_IDS_MAX,
    dmrIdMax: RADIOFOUNDRY_LIMITS.DMR_ID_MAX,
    powerLevels: board.POWER_LEVELS,
    radioIoProfileId,
    board,
    powerLadder: radioFoundryPowerLadder(board.POWER_LEVELS, board.POWER_LABELS),
  };
}

export const RADIOFOUNDRY_PROFILES: readonly RadioFoundryRadioProfile[] = [
  radioFoundryCodecProfile(
    'radiofoundry-dm32uv',
    'radio-io-dm32uv-radiofoundry',
    DM32UV_RADIOFOUNDRY_BOARD,
  ),
];

export const DEFAULT_RADIOFOUNDRY_PROFILE_ID = RADIOFOUNDRY_PROFILES[0]!.id;

export function getRadioFoundryProfile(profileId: string): RadioFoundryRadioProfile {
  const profile = RADIOFOUNDRY_PROFILES.find((row) => row.id === profileId);
  if (!profile) {
    throw new Error(`Unknown RadioFoundry profile: ${profileId}`);
  }
  return profile;
}

/** A RadioFoundry codec profile from its own id, its radio-io id, or undefined (the default). Throws on anything else. */
export function resolveRadioFoundryProfile(profileId?: string): RadioFoundryRadioProfile {
  if (profileId === undefined) return getRadioFoundryProfile(DEFAULT_RADIOFOUNDRY_PROFILE_ID);
  const profile = RADIOFOUNDRY_PROFILES.find(
    (row) => row.id === profileId || row.radioIoProfileId === profileId,
  );
  if (!profile) {
    throw new Error(`Unknown RadioFoundry profile: ${profileId}`);
  }
  return profile;
}

/** True for the cable-write profile id of any RadioFoundry radio. */
export function isRadioFoundryRadioIoProfileId(profileId: string): boolean {
  return RADIOFOUNDRY_PROFILES.some((row) => row.radioIoProfileId === profileId);
}

/** RadioFoundry codeplug profiles — export boundary only. */

import { DM32UV_RADIOFOUNDRY_LIMITS } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import type { PowerLadderEntry } from '../../profileLadder.ts';
import { RADIOFOUNDRY_CODEPLUG_FILE_NAME } from './layout.ts';

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
  /**
   * Nine steps, no watt labels. The encoder maps percent with equal steps
   * (`radioFoundryPowerByte`), not nearest-ladder lookup. Watts are unmeasured.
   */
  powerLadder: readonly PowerLadderEntry[];
}

const POWER_LADDER: readonly PowerLadderEntry[] = Array.from(
  { length: DM32UV_RADIOFOUNDRY_LIMITS.POWER_LEVELS },
  (_, index) => ({
    percent:
      index === DM32UV_RADIOFOUNDRY_LIMITS.POWER_LEVELS - 1
        ? 100
        : Math.floor((index * 100) / DM32UV_RADIOFOUNDRY_LIMITS.POWER_LEVELS) + 1,
    wire: String(index + 1),
  }),
);

export const RADIOFOUNDRY_PROFILES: readonly RadioFoundryRadioProfile[] = [
  {
    id: 'radiofoundry-dm32uv',
    label: 'RadioFoundry codeplug',
    defaultFileName: RADIOFOUNDRY_CODEPLUG_FILE_NAME,
    maxChannels: DM32UV_RADIOFOUNDRY_LIMITS.CHANNEL_MAX,
    maxZones: DM32UV_RADIOFOUNDRY_LIMITS.ZONE_MAX,
    zoneMembers: DM32UV_RADIOFOUNDRY_LIMITS.ZONE_MEMBERS_MAX,
    maxContacts: DM32UV_RADIOFOUNDRY_LIMITS.CONTACTS_MAX,
    maxRxGroupLists: DM32UV_RADIOFOUNDRY_LIMITS.RX_GROUPS_MAX,
    rxGroupListMembers: DM32UV_RADIOFOUNDRY_LIMITS.RX_GROUP_MEMBERS_MAX,
    nameLimit: DM32UV_RADIOFOUNDRY_LIMITS.NAME_MAX,
    radioNameLimit: DM32UV_RADIOFOUNDRY_LIMITS.RADIO_NAME_MAX,
    maxRadioIds: DM32UV_RADIOFOUNDRY_LIMITS.RADIO_IDS_MAX,
    dmrIdMax: DM32UV_RADIOFOUNDRY_LIMITS.DMR_ID_MAX,
    powerLevels: DM32UV_RADIOFOUNDRY_LIMITS.POWER_LEVELS,
    powerLadder: POWER_LADDER,
  },
];

export const DEFAULT_RADIOFOUNDRY_PROFILE_ID = RADIOFOUNDRY_PROFILES[0]!.id;

export function getRadioFoundryProfile(profileId: string): RadioFoundryRadioProfile {
  const profile = RADIOFOUNDRY_PROFILES.find((row) => row.id === profileId);
  if (!profile) {
    throw new Error(`Unknown RadioFoundry profile: ${profileId}`);
  }
  return profile;
}

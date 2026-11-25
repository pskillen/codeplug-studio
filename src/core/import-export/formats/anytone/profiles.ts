/** Anytone radio profiles — import/export boundary (caps + power ladder). */

import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { AT_D890UV_POWER_LADDER, selectAtD890Power } from '@core/radios/anytone/at-d890uv/power.ts';
import { radioTargetFor, radioTargetIdForProfile } from '@core/radio-targets/index.ts';
import { wireToPercent, type PowerLadderEntry } from '../../profileLadder.ts';

export interface AnytoneRadioProfile {
  id: string;
  label: string;
  maxChannels: number;
  maxZones: number;
  zoneMembers: number;
  maxScanLists: number;
  scanListMembers: number;
  maxRxGroupLists: number;
  rxGroupListMembers: number;
  /** Contacts list (`DMRTalkGroups.CSV`): talk groups and private contacts share it. */
  maxTalkGroups: number;
  /** ID database (`DMRDigitalContactList.CSV`). */
  maxDigitalContacts: number;
  nameLimit: number;
  /** Digital APRS channel slots in `APRS.CSV` (AT-D890UV). */
  maxAprsSlots: number;
  powerLadder: readonly PowerLadderEntry[];
  /** Default DMR radio ID label when channel omits one. */
  defaultRadioIdLabel: string;
  defaultRadioId: string;
}

export const ANYTONE_PROFILES: readonly AnytoneRadioProfile[] = [
  {
    id: 'anytone-at-d890uv',
    label: 'Anytone AT-D890UV',
    maxChannels: AT_D890UV_LIMITS.CHANNEL_MAX,
    maxZones: AT_D890UV_LIMITS.ZONE_MAX,
    zoneMembers: AT_D890UV_LIMITS.ZONE_MEMBERS_MAX,
    maxScanLists: AT_D890UV_LIMITS.SCAN_LISTS_MAX,
    scanListMembers: AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX,
    maxRxGroupLists: AT_D890UV_LIMITS.RX_GROUP_LISTS_MAX,
    rxGroupListMembers: AT_D890UV_LIMITS.RX_GROUP_MEMBERS_MAX,
    maxTalkGroups: AT_D890UV_LIMITS.TALK_GROUPS_MAX,
    maxDigitalContacts: AT_D890UV_LIMITS.DIGITAL_CONTACTS_MAX,
    nameLimit: AT_D890UV_LIMITS.NAME_LENGTH,
    maxAprsSlots: AT_D890UV_LIMITS.APRS_SLOTS,
    powerLadder: AT_D890UV_POWER_LADDER,
    defaultRadioIdLabel: 'TEST01',
    defaultRadioId: '1234567',
  },
] as const;

export const DEFAULT_ANYTONE_PROFILE_ID = ANYTONE_PROFILES[0]!.id;

/** Map Web Serial / sibling egress profile ids to the Anytone CSV profile for caps. */
export function resolveAnytoneCpsProfileId(profileId: string): string {
  if (ANYTONE_PROFILES.some((profile) => profile.id === profileId)) return profileId;
  if (profileId === 'radio-io-at-d890uv' || profileId === 'radio-io-at-d890uv-mm9pdy') {
    return 'anytone-at-d890uv';
  }
  const targetId = radioTargetIdForProfile(profileId);
  if (targetId) {
    const csv = radioTargetFor(targetId)?.compatibleEgress.find(
      (entry) => entry.formatId === 'anytone',
    );
    if (csv) return csv.profileId;
  }
  return profileId;
}

export function getAnytoneProfile(profileId: string): AnytoneRadioProfile {
  const resolved = resolveAnytoneCpsProfileId(profileId);
  const found = ANYTONE_PROFILES.find((p) => p.id === resolved);
  if (!found) throw new Error(`Unknown Anytone profile: ${profileId}`);
  return found;
}

export function anytoneWireToPercent(profileId: string, wire: string): number | null {
  return wireToPercent(getAnytoneProfile(profileId), wire);
}

export function anytonePercentToWire(profileId: string, percent: number | null): string {
  getAnytoneProfile(profileId);
  return selectAtD890Power(percent).wire;
}

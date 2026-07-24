/**
 * Normalised export-limit projection for UI (Radio characteristics, etc.).
 * Maps per-format `profiles.ts` fields — does not invent caps.
 * `null` = applies but not yet modelled (blank in UI); `'not_used'` = N/A for this profile.
 */

import type { FormatId } from './types.ts';
import type { PowerLadderEntry } from './profileLadder.ts';
import { getAnytoneProfile } from './formats/anytone/profiles.ts';
import { getChirpProfile } from './formats/chirp/profiles.ts';
import { getDm32Profile } from './formats/dm32/profiles.ts';
import { getOpenGd77Profile } from './formats/opengd77/profiles.ts';
import { getNeonplugProfile, isNeonplugDm32uvProfile } from './formats/neonplug/profiles.ts';
import {
  getRadioIoProfile,
  isRadioIoDm32uvProfile,
  isRadioIoOpenGd771701Profile,
} from './formats/radio-io/profiles.ts';

/** Known number, unknown blank, or not applicable to this radio workflow. */
export type ExportLimitValue = number | null | 'not_used';

export interface SiblingLadder {
  /** Operator-facing label (e.g. "Squelch"). */
  label: string;
  entries: readonly PowerLadderEntry[];
}

export interface ProfileExportLimits {
  formatId: FormatId;
  profileId: string;
  profileLabel: string;

  maxChannels: ExportLimitValue;
  maxZones: ExportLimitValue;
  maxScanLists: ExportLimitValue;
  maxRxGroupLists: ExportLimitValue;
  maxContacts: ExportLimitValue;
  maxTalkGroups: ExportLimitValue;

  zoneMembers: ExportLimitValue;
  scanListMembers: ExportLimitValue;
  rxGroupListMembers: ExportLimitValue;

  nameLengthChannel: ExportLimitValue;
  nameLengthZone: ExportLimitValue;
  nameLengthContact: ExportLimitValue;
  nameLengthTalkGroup: ExportLimitValue;
  nameLengthScanList: ExportLimitValue;
  nameLengthRxGroupList: ExportLimitValue;

  powerLadder: readonly PowerLadderEntry[];
  siblingLadders: readonly SiblingLadder[];
}

function blankDigitalOrganisation(partial: {
  formatId: FormatId;
  profileId: string;
  profileLabel: string;
  maxChannels: number;
  nameLengthChannel: number;
  powerLadder: readonly PowerLadderEntry[];
  siblingLadders?: readonly SiblingLadder[];
  maxZones?: ExportLimitValue;
  maxScanLists?: ExportLimitValue;
  maxRxGroupLists?: ExportLimitValue;
  maxContacts?: ExportLimitValue;
  maxTalkGroups?: ExportLimitValue;
  zoneMembers?: ExportLimitValue;
  scanListMembers?: ExportLimitValue;
  rxGroupListMembers?: ExportLimitValue;
  nameLengthZone?: ExportLimitValue;
  nameLengthContact?: ExportLimitValue;
  nameLengthTalkGroup?: ExportLimitValue;
  nameLengthScanList?: ExportLimitValue;
  nameLengthRxGroupList?: ExportLimitValue;
}): ProfileExportLimits {
  return {
    formatId: partial.formatId,
    profileId: partial.profileId,
    profileLabel: partial.profileLabel,
    maxChannels: partial.maxChannels,
    maxZones: partial.maxZones ?? null,
    maxScanLists: partial.maxScanLists ?? null,
    maxRxGroupLists: partial.maxRxGroupLists ?? null,
    maxContacts: partial.maxContacts ?? null,
    maxTalkGroups: partial.maxTalkGroups ?? null,
    zoneMembers: partial.zoneMembers ?? null,
    scanListMembers: partial.scanListMembers ?? null,
    rxGroupListMembers: partial.rxGroupListMembers ?? null,
    nameLengthChannel: partial.nameLengthChannel,
    nameLengthZone: partial.nameLengthZone ?? null,
    nameLengthContact: partial.nameLengthContact ?? null,
    nameLengthTalkGroup: partial.nameLengthTalkGroup ?? null,
    nameLengthScanList: partial.nameLengthScanList ?? null,
    nameLengthRxGroupList: partial.nameLengthRxGroupList ?? null,
    powerLadder: partial.powerLadder,
    siblingLadders: partial.siblingLadders ?? [],
  };
}

/** Export limits + ladders for a format profile — export boundary only. */
export function getProfileExportLimits(
  formatId: FormatId,
  profileId: string,
): ProfileExportLimits | null {
  try {
    if (formatId === 'opengd77') {
      const profile = getOpenGd77Profile(profileId);
      return blankDigitalOrganisation({
        formatId,
        profileId: profile.id,
        profileLabel: profile.label,
        maxChannels: profile.maxChannels,
        nameLengthChannel: profile.nameLimit,
        powerLadder: profile.powerLadder,
        maxZones: null,
        maxScanLists: 'not_used',
        maxRxGroupLists: null,
        maxContacts: null,
        maxTalkGroups: null,
        zoneMembers: profile.zoneMembers,
        scanListMembers: 'not_used',
        rxGroupListMembers: profile.tgListMembers,
        nameLengthZone: null,
        nameLengthContact: null,
        nameLengthTalkGroup: null,
        nameLengthScanList: 'not_used',
        nameLengthRxGroupList: null,
      });
    }

    if (formatId === 'dm32') {
      const profile = getDm32Profile(profileId);
      return blankDigitalOrganisation({
        formatId,
        profileId: profile.id,
        profileLabel: profile.label,
        maxChannels: profile.maxChannels,
        nameLengthChannel: profile.nameLimit,
        powerLadder: profile.powerLadder,
        siblingLadders: [{ label: 'Squelch', entries: profile.squelchLadder }],
        maxZones: profile.maxZones,
        maxScanLists: profile.maxScanLists,
        maxRxGroupLists: profile.maxRxGroupLists,
        maxContacts: profile.maxContacts,
        maxTalkGroups: profile.maxTalkGroups,
        zoneMembers: profile.zoneMembers,
        scanListMembers: profile.scanListMembers,
        rxGroupListMembers: profile.rxGroupListMembers,
        nameLengthZone: profile.nameLimit,
        nameLengthContact: profile.nameLimit,
        nameLengthTalkGroup: profile.nameLimit,
        nameLengthScanList: profile.scanListNameLimit,
        nameLengthRxGroupList: profile.rxGroupListNameLimit,
      });
    }

    if (formatId === 'anytone') {
      const profile = getAnytoneProfile(profileId);
      return blankDigitalOrganisation({
        formatId,
        profileId: profile.id,
        profileLabel: profile.label,
        maxChannels: profile.maxChannels,
        nameLengthChannel: profile.nameLimit,
        powerLadder: profile.powerLadder,
        maxZones: null,
        maxScanLists: profile.maxScanLists,
        maxRxGroupLists: null,
        maxContacts: null,
        maxTalkGroups: null,
        zoneMembers: profile.zoneMembers,
        scanListMembers: profile.scanListMembers,
        rxGroupListMembers: profile.rxGroupListMembers,
        nameLengthZone: null,
        nameLengthContact: null,
        nameLengthTalkGroup: null,
        nameLengthScanList: null,
        nameLengthRxGroupList: null,
      });
    }

    if (formatId === 'chirp') {
      const profile = getChirpProfile(profileId);
      return {
        formatId,
        profileId: profile.id,
        profileLabel: profile.label,
        maxChannels: profile.maxMemorySlots,
        maxZones: 'not_used',
        maxScanLists: 'not_used',
        maxRxGroupLists: 'not_used',
        maxContacts: 'not_used',
        maxTalkGroups: 'not_used',
        zoneMembers: 'not_used',
        scanListMembers: 'not_used',
        rxGroupListMembers: 'not_used',
        nameLengthChannel: profile.nameLimit,
        nameLengthZone: 'not_used',
        nameLengthContact: 'not_used',
        nameLengthTalkGroup: 'not_used',
        nameLengthScanList: 'not_used',
        nameLengthRxGroupList: 'not_used',
        powerLadder: profile.powerLadder,
        siblingLadders: [],
      };
    }

    if (formatId === 'neonplug') {
      const profile = getNeonplugProfile(profileId);
      if (isNeonplugDm32uvProfile(profile)) {
        return blankDigitalOrganisation({
          formatId,
          profileId: profile.id,
          profileLabel: profile.label,
          maxChannels: profile.maxChannels,
          nameLengthChannel: profile.nameLimit,
          powerLadder: profile.powerLadder,
          siblingLadders: [{ label: 'Squelch', entries: profile.squelchLadder }],
          maxZones: profile.maxZones,
          maxScanLists: profile.maxScanLists,
          maxRxGroupLists: profile.maxRxGroupLists,
          maxContacts: profile.maxContacts,
          maxTalkGroups: profile.maxTalkGroups,
          zoneMembers: profile.zoneMembers,
          scanListMembers: profile.scanListMembers,
          rxGroupListMembers: profile.rxGroupListMembers,
          nameLengthZone: profile.nameLimit,
          nameLengthContact: profile.nameLimit,
          nameLengthTalkGroup: profile.nameLimit,
          nameLengthScanList: profile.scanListNameLimit,
          nameLengthRxGroupList: profile.rxGroupListNameLimit,
        });
      }
      return {
        formatId,
        profileId: profile.id,
        profileLabel: profile.label,
        maxChannels: profile.maxMemorySlots,
        maxZones: 'not_used',
        maxScanLists: 'not_used',
        maxRxGroupLists: 'not_used',
        maxContacts: 'not_used',
        maxTalkGroups: 'not_used',
        zoneMembers: 'not_used',
        scanListMembers: 'not_used',
        rxGroupListMembers: 'not_used',
        nameLengthChannel: profile.nameLimit,
        nameLengthZone: 'not_used',
        nameLengthContact: 'not_used',
        nameLengthTalkGroup: 'not_used',
        nameLengthScanList: 'not_used',
        nameLengthRxGroupList: 'not_used',
        powerLadder: profile.powerLadder,
        siblingLadders: [],
      };
    }

    if (formatId === 'radio-io') {
      const profile = getRadioIoProfile(profileId);
      if (isRadioIoDm32uvProfile(profile)) {
        return {
          formatId,
          profileId: profile.id,
          profileLabel: profile.label,
          maxChannels: profile.maxMemorySlots,
          maxZones: profile.maxZones,
          maxScanLists: profile.maxScanLists,
          maxRxGroupLists: profile.maxRxGroupLists,
          maxContacts: null,
          maxTalkGroups: null,
          zoneMembers: profile.zoneMembers,
          scanListMembers: profile.scanListMembers,
          rxGroupListMembers: profile.rxGroupListMembers,
          nameLengthChannel: profile.nameLimit,
          nameLengthZone: profile.nameLimit,
          nameLengthContact: profile.nameLimit,
          nameLengthTalkGroup: profile.nameLimit,
          nameLengthScanList: 10,
          nameLengthRxGroupList: 10,
          powerLadder: profile.powerLadder,
          siblingLadders: [],
        };
      }
      if (isRadioIoOpenGd771701Profile(profile)) {
        return {
          formatId,
          profileId: profile.id,
          profileLabel: profile.label,
          maxChannels: profile.maxMemorySlots,
          maxZones: profile.maxZones,
          maxScanLists: profile.maxScanLists,
          maxRxGroupLists: profile.maxRxGroupLists,
          maxContacts: null,
          maxTalkGroups: null,
          zoneMembers: profile.zoneMembers,
          scanListMembers: profile.scanListMembers,
          rxGroupListMembers: profile.rxGroupListMembers,
          nameLengthChannel: profile.nameLimit,
          nameLengthZone: profile.nameLimit,
          nameLengthContact: profile.nameLimit,
          nameLengthTalkGroup: profile.nameLimit,
          nameLengthScanList: 'not_used',
          nameLengthRxGroupList: profile.nameLimit,
          powerLadder: profile.powerLadder,
          siblingLadders: [],
        };
      }
      return {
        formatId,
        profileId: profile.id,
        profileLabel: profile.label,
        maxChannels: profile.maxMemorySlots,
        maxZones: 'not_used',
        maxScanLists: 'not_used',
        maxRxGroupLists: 'not_used',
        maxContacts: 'not_used',
        maxTalkGroups: 'not_used',
        zoneMembers: 'not_used',
        scanListMembers: 'not_used',
        rxGroupListMembers: 'not_used',
        nameLengthChannel: profile.nameLimit,
        nameLengthZone: 'not_used',
        nameLengthContact: 'not_used',
        nameLengthTalkGroup: 'not_used',
        nameLengthScanList: 'not_used',
        nameLengthRxGroupList: 'not_used',
        powerLadder: profile.powerLadder,
        siblingLadders: [],
      };
    }
  } catch {
    return null;
  }

  return null;
}

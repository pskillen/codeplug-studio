import type { FormatId } from './types.ts';
import {
  CHIRP_PROFILES,
  getChirpProfile,
  type ChirpRadioProfile,
} from './formats/chirp/profiles.ts';
import { DM32_PROFILES, getDm32Profile, type Dm32RadioProfile } from './formats/dm32/profiles.ts';
import {
  OPENGD77_PROFILES,
  getOpenGd77Profile,
  type OpenGd77RadioProfile,
} from './formats/opengd77/profiles.ts';
import {
  ANYTONE_PROFILES,
  getAnytoneProfile,
  type AnytoneRadioProfile,
} from './formats/anytone/profiles.ts';

export interface FormatProfileOption {
  profileId: string;
  label: string;
  formatId: FormatId;
  /** Wire limits summary for UI hints — export boundary only. */
  nameLimit?: number;
  maxChannels?: number;
}

/** Radio variant profiles for a CPS format — UI and export adapters. */
export function getFormatProfiles(formatId: 'opengd77'): FormatProfileOption[];
export function getFormatProfiles(formatId: 'dm32'): FormatProfileOption[];
export function getFormatProfiles(formatId: 'chirp'): FormatProfileOption[];
export function getFormatProfiles(formatId: 'anytone'): FormatProfileOption[];
export function getFormatProfiles(formatId: FormatId): FormatProfileOption[];
export function getFormatProfiles(formatId: FormatId): FormatProfileOption[] {
  if (formatId === 'opengd77') {
    return OPENGD77_PROFILES.map(openGd77ProfileToOption);
  }
  if (formatId === 'dm32') {
    return DM32_PROFILES.map(dm32ProfileToOption);
  }
  if (formatId === 'chirp') {
    return CHIRP_PROFILES.map(chirpProfileToOption);
  }
  if (formatId === 'anytone') {
    return ANYTONE_PROFILES.map(anytoneProfileToOption);
  }
  return [];
}

function openGd77ProfileToOption(profile: OpenGd77RadioProfile): FormatProfileOption {
  return {
    profileId: profile.id,
    label: profile.label,
    formatId: 'opengd77',
    nameLimit: profile.nameLimit,
    maxChannels: profile.maxChannels,
  };
}

function dm32ProfileToOption(profile: Dm32RadioProfile): FormatProfileOption {
  return {
    profileId: profile.id,
    label: profile.label,
    formatId: 'dm32',
    nameLimit: profile.nameLimit,
    maxChannels: profile.maxChannels,
  };
}

function chirpProfileToOption(profile: ChirpRadioProfile): FormatProfileOption {
  return {
    profileId: profile.id,
    label: profile.label,
    formatId: 'chirp',
    nameLimit: profile.nameLimit,
    maxChannels: profile.maxMemorySlots,
  };
}

function anytoneProfileToOption(profile: AnytoneRadioProfile): FormatProfileOption {
  return {
    profileId: profile.id,
    label: profile.label,
    formatId: 'anytone',
    nameLimit: profile.nameLimit,
    maxChannels: profile.maxChannels,
  };
}

/** Read-only wire-limit summary for build detail UI — export boundary only. */
export function formatProfileWireHint(formatId: FormatId, profileId: string): string | null {
  if (formatId === 'opengd77') {
    try {
      const profile = getOpenGd77Profile(profileId);
      return `${profile.nameLimit}-char wire names · ${profile.maxChannels} channels max · ${profile.zoneMembers} zone members`;
    } catch {
      return null;
    }
  }
  if (formatId === 'dm32') {
    try {
      const profile = getDm32Profile(profileId);
      return `${profile.nameLimit}-char wire names · ${profile.maxChannels} channels max · ${profile.rxGroupListMembers} RX list members · ${profile.scanListMembers} scan members`;
    } catch {
      return null;
    }
  }
  if (formatId === 'chirp') {
    try {
      const profile = getChirpProfile(profileId);
      return `${profile.nameLimit}-char wire names · ${profile.maxMemorySlots} memory slots`;
    } catch {
      return null;
    }
  }
  if (formatId === 'anytone') {
    try {
      const profile = getAnytoneProfile(profileId);
      return `${profile.nameLimit}-char wire names · ${profile.maxChannels} channels max · ${profile.scanListMembers} scan members`;
    } catch {
      return null;
    }
  }
  return null;
}

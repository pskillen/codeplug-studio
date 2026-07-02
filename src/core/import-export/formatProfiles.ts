import type { FormatId } from './types.ts';
import {
  OPENGD77_PROFILES,
  type OpenGd77RadioProfile,
} from './formats/opengd77/profiles.ts';

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
export function getFormatProfiles(formatId: FormatId): FormatProfileOption[];
export function getFormatProfiles(formatId: FormatId): FormatProfileOption[] {
  if (formatId === 'opengd77') {
    return OPENGD77_PROFILES.map(openGd77ProfileToOption);
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

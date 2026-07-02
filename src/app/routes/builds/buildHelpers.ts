import type { FormatId } from '@core/import-export/types.ts';
import { getFormatProfiles } from '@core/import-export/formatProfiles.ts';
import { TRAIT_PROFILES } from '@core/models/traits.ts';

export interface BuildProfileOption {
  profileId: string;
  label: string;
  formatId: FormatId;
  hint?: string;
}

/** Profiles available when creating a build for a CPS format. */
export function buildProfileOptionsForFormat(formatId: FormatId): BuildProfileOption[] {
  if (formatId === 'opengd77') {
    return getFormatProfiles('opengd77').map((p) => ({
      profileId: p.profileId,
      label: p.label,
      formatId: 'opengd77',
      hint:
        p.nameLimit != null
          ? `${p.nameLimit}-char names · up to ${p.maxChannels ?? '?'} channels`
          : undefined,
    }));
  }
  return Object.values(TRAIT_PROFILES)
    .filter((p) => p.formatId === formatId)
    .map((p) => ({
      profileId: p.profileId,
      label: p.label,
      formatId: p.formatId as FormatId,
    }));
}

export const TRAIT_LABELS: Record<string, string> = {
  zoneGrouping: 'Zone grouping',
  flatMemoryList: 'Flat memory list',
  perChannelScanFlag: 'Per-channel scan flag',
  scanLists: 'Scan lists',
  zoneAsScanList: 'Zone as scan list',
  multiTalkGroupPerChannel: 'Multi talk group per channel',
  mxnChannelExpansion: 'm×n channel expansion',
};

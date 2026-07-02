export const BuildCapabilityTrait = {
  ZoneGrouping: 'zoneGrouping',
  FlatMemoryList: 'flatMemoryList',
  PerChannelScanFlag: 'perChannelScanFlag',
  ScanLists: 'scanLists',
  ZoneAsScanList: 'zoneAsScanList',
  MultiTalkGroupPerChannel: 'multiTalkGroupPerChannel',
  MxNChannelExpansion: 'mxnChannelExpansion',
} as const;

export type BuildCapabilityTrait = (typeof BuildCapabilityTrait)[keyof typeof BuildCapabilityTrait];

export interface TraitProfile {
  profileId: string;
  formatId: string;
  label: string;
  traits: readonly BuildCapabilityTrait[];
}

export const TRAIT_PROFILES: Record<string, TraitProfile> = {
  'opengd77-1701': {
    profileId: 'opengd77-1701',
    formatId: 'opengd77',
    label: 'OpenGD77 (1701)',
    traits: [
      BuildCapabilityTrait.ZoneGrouping,
      BuildCapabilityTrait.ZoneAsScanList,
      BuildCapabilityTrait.MultiTalkGroupPerChannel,
    ],
  },
  'opengd77-md9600': {
    profileId: 'opengd77-md9600',
    formatId: 'opengd77',
    label: 'OpenGD77 (MD9600)',
    traits: [
      BuildCapabilityTrait.ZoneGrouping,
      BuildCapabilityTrait.ZoneAsScanList,
      BuildCapabilityTrait.MultiTalkGroupPerChannel,
    ],
  },
  'dm32-default': {
    profileId: 'dm32-default',
    formatId: 'dm32',
    label: 'Baofeng DM32',
    traits: [
      BuildCapabilityTrait.ZoneGrouping,
      BuildCapabilityTrait.ScanLists,
      BuildCapabilityTrait.MxNChannelExpansion,
    ],
  },
  'chirp-uv5r': {
    profileId: 'chirp-uv5r',
    formatId: 'chirp',
    label: 'CHIRP UV-5R',
    traits: [BuildCapabilityTrait.FlatMemoryList, BuildCapabilityTrait.PerChannelScanFlag],
  },
};

export function traitProfileFor(profileId: string): TraitProfile | undefined {
  return TRAIT_PROFILES[profileId];
}

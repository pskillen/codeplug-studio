export const BuildCapabilityTrait = {
  ZoneGrouping: 'zoneGrouping',
  FlatMemoryList: 'flatMemoryList',
  PerChannelScanFlag: 'perChannelScanFlag',
  /** Zone-derived scan list synthesis (e.g. DM32 Scan.csv from zone members + default scan inclusion). */
  ScanLists: 'scanLists',
  /** First-class library scan lists + per-channel scan list FK (e.g. Anytone ScanList.CSV). */
  DedicatedScanLists: 'dedicatedScanLists',
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
  'dm32-baofeng-dm32uv': {
    profileId: 'dm32-baofeng-dm32uv',
    formatId: 'dm32',
    label: 'Baofeng DM-32UV',
    traits: [
      BuildCapabilityTrait.ZoneGrouping,
      BuildCapabilityTrait.ScanLists,
      BuildCapabilityTrait.MxNChannelExpansion,
    ],
  },
  'chirp-uv5r': {
    profileId: 'chirp-uv5r',
    formatId: 'chirp',
    label: 'Baofeng UV-5R Mini',
    traits: [BuildCapabilityTrait.FlatMemoryList, BuildCapabilityTrait.PerChannelScanFlag],
  },
  'chirp-rt95': {
    profileId: 'chirp-rt95',
    formatId: 'chirp',
    label: 'Retevis RT95 VOX',
    traits: [BuildCapabilityTrait.FlatMemoryList, BuildCapabilityTrait.PerChannelScanFlag],
  },
  'chirp-uv21': {
    profileId: 'chirp-uv21',
    formatId: 'chirp',
    label: 'Baofeng UV-21Pro V2',
    traits: [BuildCapabilityTrait.FlatMemoryList, BuildCapabilityTrait.PerChannelScanFlag],
  },
  'anytone-at-d890uv': {
    profileId: 'anytone-at-d890uv',
    formatId: 'anytone',
    label: 'Anytone AT-D890UV',
    traits: [
      BuildCapabilityTrait.ZoneGrouping,
      BuildCapabilityTrait.DedicatedScanLists,
      BuildCapabilityTrait.MxNChannelExpansion,
    ],
  },
};

export function traitProfileFor(profileId: string): TraitProfile | undefined {
  return TRAIT_PROFILES[profileId];
}

export function hasDedicatedScanLists(profileId: string): boolean {
  const traits = traitProfileFor(profileId)?.traits ?? [];
  return traits.includes(BuildCapabilityTrait.DedicatedScanLists);
}

/** Whether the export page should show default scan inclusion (zone-derived / per-channel scan flag semantics). */
export function showsDefaultScanInclusion(profileId: string): boolean {
  return !hasDedicatedScanLists(profileId);
}

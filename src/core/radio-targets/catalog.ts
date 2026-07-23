import { BuildCapabilityTrait, type BuildCapabilityTrait as Trait } from '@core/models/traits.ts';
import { egressKindForFormatId, type EgressKind } from '@core/models/egressPath.ts';

/** One compatible CPS / Web Serial pathway for a radio target. */
export interface CompatibleEgress {
  formatId: string;
  profileId: string;
  kind: EgressKind;
  /** Short label for egress switcher. */
  label: string;
}

export interface RadioTarget {
  id: string;
  label: string;
  /** Manufacturer / family for list grouping. */
  group: string;
  traits: readonly Trait[];
  compatibleEgress: readonly CompatibleEgress[];
}

function egress(formatId: string, profileId: string, label: string): CompatibleEgress {
  return {
    formatId,
    profileId,
    kind: egressKindForFormatId(formatId),
    label,
  };
}

const flatAnalog: readonly Trait[] = [
  BuildCapabilityTrait.FlatMemoryList,
  BuildCapabilityTrait.PerChannelScanFlag,
];

const dm32Traits: readonly Trait[] = [
  BuildCapabilityTrait.ZoneGrouping,
  BuildCapabilityTrait.ScanLists,
  BuildCapabilityTrait.MxNChannelExpansion,
];

const opengd77Traits: readonly Trait[] = [
  BuildCapabilityTrait.ZoneGrouping,
  BuildCapabilityTrait.ZoneAsScanList,
  BuildCapabilityTrait.MultiTalkGroupPerChannel,
];

const anytoneTraits: readonly Trait[] = [
  BuildCapabilityTrait.ZoneGrouping,
  BuildCapabilityTrait.DedicatedScanLists,
  BuildCapabilityTrait.MxNChannelExpansion,
];

/** Authoritative radio-target catalog (#654). */
export const RADIO_TARGETS: Record<string, RadioTarget> = {
  'baofeng-uv5r-mini': {
    id: 'baofeng-uv5r-mini',
    label: 'Baofeng UV-5R Mini',
    group: 'Baofeng',
    traits: flatAnalog,
    compatibleEgress: [
      egress('radio-io', 'radio-io-uv5r-mini', 'Web Serial'),
      egress('neonplug', 'neonplug-uv5rmini', 'NeonPlug'),
      egress('chirp', 'chirp-uv5r', 'CHIRP CSV'),
    ],
  },
  'baofeng-uv21': {
    id: 'baofeng-uv21',
    label: 'Baofeng UV-21Pro V2',
    group: 'Baofeng',
    traits: flatAnalog,
    compatibleEgress: [egress('chirp', 'chirp-uv21', 'CHIRP CSV')],
  },
  'retevis-rt95': {
    id: 'retevis-rt95',
    label: 'Retevis RT95 VOX',
    group: 'Retevis',
    traits: flatAnalog,
    compatibleEgress: [egress('chirp', 'chirp-rt95', 'CHIRP CSV')],
  },
  'baofeng-dm32uv': {
    id: 'baofeng-dm32uv',
    label: 'Baofeng DM-32UV',
    group: 'Baofeng',
    traits: dm32Traits,
    compatibleEgress: [
      egress('neonplug', 'neonplug-dm32uv', 'NeonPlug'),
      egress('dm32', 'dm32-baofeng-dm32uv', 'DM32 CSV'),
    ],
  },
  'baofeng-dm1701': {
    id: 'baofeng-dm1701',
    label: 'Baofeng DM-1701 / RT-84 (OpenGD77)',
    group: 'Baofeng',
    traits: opengd77Traits,
    compatibleEgress: [egress('opengd77', 'opengd77-1701', 'OpenGD77 CSV')],
  },
  'tyt-md9600': {
    id: 'tyt-md9600',
    label: 'TYT MD-9600 / RT-90 (OpenGD77)',
    group: 'TYT',
    traits: opengd77Traits,
    compatibleEgress: [egress('opengd77', 'opengd77-md9600', 'OpenGD77 CSV')],
  },
  'anytone-at-d890uv': {
    id: 'anytone-at-d890uv',
    label: 'Anytone AT-D890UV',
    group: 'Anytone',
    traits: anytoneTraits,
    compatibleEgress: [egress('anytone', 'anytone-at-d890uv', 'Anytone CSV')],
  },
};

export function listRadioTargets(): RadioTarget[] {
  return Object.values(RADIO_TARGETS);
}

export function radioTargetFor(radioTargetId: string): RadioTarget | undefined {
  return RADIO_TARGETS[radioTargetId];
}

/** Traits for a radio target — drives build nav / layout capability. */
export function traitsForRadioTarget(radioTargetId: string): readonly Trait[] {
  return radioTargetFor(radioTargetId)?.traits ?? [];
}

export function radioTargetHasTrait(radioTargetId: string, trait: Trait): boolean {
  return traitsForRadioTarget(radioTargetId).includes(trait);
}

/**
 * Resolve which radio target owns a legacy / egress profile id.
 * Used when seeding egress from profile or mapping old test helpers.
 */
export function radioTargetIdForProfile(profileId: string): string | undefined {
  for (const target of listRadioTargets()) {
    if (target.compatibleEgress.some((e) => e.profileId === profileId)) {
      return target.id;
    }
  }
  return undefined;
}

export function compatibleEgressForProfile(
  radioTargetId: string,
  profileId: string,
): CompatibleEgress | undefined {
  return radioTargetFor(radioTargetId)?.compatibleEgress.find((e) => e.profileId === profileId);
}

export function defaultCompatibleEgress(radioTargetId: string): CompatibleEgress | undefined {
  return radioTargetFor(radioTargetId)?.compatibleEgress[0];
}

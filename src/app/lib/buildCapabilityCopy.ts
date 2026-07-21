/**
 * Operator-facing copy for build organisation capabilities (Radio characteristics, Overview badges).
 * Do not say “traits” in user-facing strings — see help-writing-styleguide.md.
 */

import type { FormatId } from '@core/import-export/types.ts';
import {
  BuildCapabilityTrait,
  type BuildCapabilityTrait as CapabilityId,
} from '@core/models/traits.ts';

/** Short intro for the Radio characteristics “how this radio is organised” section. */
export const BUILD_ORGANISATION_INTRO =
  'Each radio (or CPS variant) organises channels differently. This page lists what applies to the profile you chose — which build pages you get, how scanning works, and how export may expand channels into extra rows.';

export interface CapabilityCopy {
  label: string;
  /** One or two sentences — what this means for the operator. */
  summary: string;
  /** Concrete consequences (pages, export behaviour). */
  consequences: string[];
  /** Extra note when the same capability differs by format. */
  formatNotes?: Partial<Record<FormatId, string>>;
}

const CAPABILITY_COPY: Record<CapabilityId, CapabilityCopy> = {
  [BuildCapabilityTrait.ZoneGrouping]: {
    label: 'Zone grouping',
    summary:
      'Channels are grouped into named zones. On the radio you switch zone to change which channels are available.',
    consequences: [
      'This build has a Zones page for membership and order.',
      'Export writes zone membership for your CPS.',
    ],
  },
  [BuildCapabilityTrait.FlatMemoryList]: {
    label: 'Flat memory list',
    summary:
      'There are no zones — channels sit in one ordered memory list, as on many analogue handhelds.',
    consequences: [
      'Talk groups, contacts, and RX group lists are hidden for this build.',
      'Export fills memory slots in list order.',
    ],
  },
  [BuildCapabilityTrait.PerChannelScanFlag]: {
    label: 'Per-channel scan flag',
    summary:
      'Scanning is controlled per channel (include or skip), not with a separate scan-list entity.',
    consequences: [
      'This build has a Scan list page for include/skip per memory.',
      'Export uses each channel’s scan setting on the wire.',
    ],
  },
  [BuildCapabilityTrait.ScanLists]: {
    label: 'Scan lists',
    summary:
      'Named scan sequences are built from zone membership and default scan inclusion — not as separate library scan-list entities.',
    consequences: [
      'Use Zones and export scan settings to control what is scanned.',
      'There is no separate Scan lists build page for this profile.',
    ],
    formatNotes: {
      dm32: 'On DM-32UV, Studio synthesises scan rows from zones and your default scan inclusion. That differs from radios with dedicated scan-list files.',
    },
  },
  [BuildCapabilityTrait.DedicatedScanLists]: {
    label: 'Dedicated scan lists',
    summary:
      'Scan lists are first-class: you curate named lists and assign them to channels, separate from zones.',
    consequences: [
      'This build has a Scan lists page.',
      'Export writes dedicated scan-list files and per-channel assignments.',
    ],
    formatNotes: {
      anytone:
        'On Anytone, scan lists are separate from zones. Assign a list on each channel when you want it to participate in that scan sequence.',
    },
  },
  [BuildCapabilityTrait.ZoneAsScanList]: {
    label: 'Zone as scan list',
    summary:
      'Zone membership doubles as the scan sequence — the zone is the scan list. There is no separate scan-list file.',
    consequences: [
      'Order channels in Zones to set both browsing and scan order.',
      'Export does not emit a separate scan-list table for this profile.',
    ],
  },
  [BuildCapabilityTrait.MultiTalkGroupPerChannel]: {
    label: 'Multi talk group per channel',
    summary:
      'One RF channel can carry several talk groups via an RX group list. The radio (or CPS) lets you pick the talk group without duplicating the channel row for every TG.',
    consequences: [
      'Keep talk groups on the channel’s RX group list in the library.',
      'Export typically keeps one channel row and a separate TG / RX-list file.',
    ],
  },
  [BuildCapabilityTrait.MxNChannelExpansion]: {
    label: 'm×n channel expansion',
    summary:
      'This radio expects one memory per repeater × talk-group pair. Export may expand a single library channel into several CPS rows.',
    consequences: [
      'Preview and export can show more channel rows than channels in your library.',
      'Wire names for expanded rows follow your export naming settings.',
    ],
  },
};

/** Display labels for badges and export toggles — same source as characteristics. */
export const TRAIT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(CAPABILITY_COPY).map(([id, copy]) => [id, copy.label]),
);

export function capabilityCopyFor(trait: CapabilityId): CapabilityCopy {
  return CAPABILITY_COPY[trait];
}

export function capabilityLabel(trait: string): string {
  return TRAIT_LABELS[trait] ?? trait;
}

export interface CapabilityConcept {
  id: string;
  title: string;
  body: string;
}

/**
 * Extra operator concepts that apply when the given capabilities are present.
 * Only returns entries relevant to the active set.
 */
export function conceptsForCapabilities(
  traits: readonly CapabilityId[],
  formatId: FormatId,
): CapabilityConcept[] {
  const set = new Set(traits);
  const concepts: CapabilityConcept[] = [];

  if (set.has(BuildCapabilityTrait.FlatMemoryList)) {
    concepts.push({
      id: 'flat-memory',
      title: 'Flat memory (no zones)',
      body: 'Channels are one continuous list. There is no zone switch on the radio for this workflow — use channel order and the per-channel scan flag instead.',
    });
  }

  if (set.has(BuildCapabilityTrait.ZoneGrouping) && !set.has(BuildCapabilityTrait.FlatMemoryList)) {
    concepts.push({
      id: 'zones',
      title: 'Zones vs library',
      body: 'Zones on this build organise which library channels travel together for this radio. The same library channel can sit in different zones (or none) on other builds.',
    });
  }

  if (set.has(BuildCapabilityTrait.ZoneAsScanList)) {
    concepts.push({
      id: 'zone-scan',
      title: 'Scanning follows the zone',
      body: 'For this profile, the channels in a zone are also the scan sequence. Reorder the zone if you want a different scan order.',
    });
  }

  if (set.has(BuildCapabilityTrait.ScanLists) && formatId === 'dm32') {
    concepts.push({
      id: 'zone-derived-scan',
      title: 'Scan lists from zones',
      body: 'Scan sequences are derived from zone membership and your default scan inclusion on export — you do not maintain a separate scan-list inventory for this radio.',
    });
  }

  if (set.has(BuildCapabilityTrait.DedicatedScanLists)) {
    concepts.push({
      id: 'dedicated-scan',
      title: 'Separate scan lists',
      body: 'Scan lists are their own entities. Build them on the Scan lists page, then assign them on channels that should use that list.',
    });
  }

  if (set.has(BuildCapabilityTrait.MxNChannelExpansion)) {
    concepts.push({
      id: 'mxn',
      title: 'Extra rows on export',
      body: 'When a channel’s RX group list has several talk groups (or contacts), export can create one CPS channel row per member. Check Channels wire preview before you flash.',
    });
  }

  if (set.has(BuildCapabilityTrait.MultiTalkGroupPerChannel)) {
    concepts.push({
      id: 'multi-tg',
      title: 'One channel, several talk groups',
      body: 'You attach an RX group list to the channel instead of exploding every talk group into its own memory. The radio workflow picks the talk group at use time.',
    });
  }

  return concepts;
}

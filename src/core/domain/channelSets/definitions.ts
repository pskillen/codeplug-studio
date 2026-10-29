import {
  euCbCeptTemplates,
  pdmr32Templates,
  pdmrTemplates,
  pmr446Templates,
  ukCb2781Templates,
  ukUhfSimplexLegacyTemplates,
  ukUhfSimplexUTemplates,
  ukVhfSimplexSTemplates,
  ukVhfSimplexVTemplates,
} from './frequencies.ts';
import type { ChannelSetDefinition, ChannelSetId } from './types.ts';

export const CHANNEL_SET_DEFINITIONS: readonly ChannelSetDefinition[] = [
  {
    id: 'pmr446',
    label: 'PMR446',
    description:
      '16 licence-free PMR446 channels (446 MHz, 12.5 kHz). RX-only typical on ham rigs.',
    defaultForbidTransmit: true,
    defaultBandwidthKHz: 12.5,
    templates: pmr446Templates,
  },
  {
    id: 'pdmr',
    label: 'pDMR channels (16)',
    description:
      '16 licence-free pDMR (DMR Tier 1) simplex channels on the PMR446 frequencies (446.00625–446.19375 MHz, 12.5 kHz). Colour code 1, timeslot 1. RX-only typical on ham rigs.',
    defaultForbidTransmit: true,
    defaultBandwidthKHz: 12.5,
    mode: 'dmr',
    dmr: { colourCode: 1, timeslot: 1 },
    templates: pdmrTemplates,
  },
  {
    id: 'pdmr-32',
    label: 'pDMR channels (32)',
    description:
      '32 pDMR (DMR Tier 1) simplex channels on the 6.25 kHz digital PMR446 grid (446.003125–446.196875 MHz). DMR is 12.5 kHz wide, so adjacent channels overlap; the 16-channel set is the non-overlapping choice. Colour code 1, timeslot 1. RX-only typical on ham rigs.',
    defaultForbidTransmit: true,
    defaultBandwidthKHz: 12.5,
    mode: 'dmr',
    dmr: { colourCode: 1, timeslot: 1 },
    templates: pdmr32Templates,
  },
  {
    id: 'uk-vhf-simplex-v',
    label: 'UK VHF simplex (V-channels)',
    description:
      '30 UK 2 m FM simplex channels V16–V45 (145.200–145.5625 MHz). Calling V40 @ 145.500 MHz.',
    defaultForbidTransmit: false,
    defaultBandwidthKHz: 12.5,
    templates: ukVhfSimplexVTemplates,
  },
  {
    id: 'uk-vhf-simplex-s',
    label: 'UK VHF simplex (legacy S08–S23)',
    description:
      '16 legacy S-channels on even V-channel frequencies (145.200–145.575 MHz). Calling S20 @ 145.500 MHz.',
    defaultForbidTransmit: false,
    defaultBandwidthKHz: 12.5,
    templates: ukVhfSimplexSTemplates,
  },
  {
    id: 'uk-uhf-simplex-u',
    label: 'UK UHF simplex (U-channels)',
    description:
      '17 UK 70 cm FM simplex channels U272–U288 (433.400–433.600 MHz). Calling U280 @ 433.500 MHz.',
    defaultForbidTransmit: false,
    defaultBandwidthKHz: 12.5,
    templates: ukUhfSimplexUTemplates,
  },
  {
    id: 'uk-uhf-simplex-s',
    label: 'UK UHF simplex (legacy SU16–SU32)',
    description:
      'Same frequencies as U-channels with legacy SU16–SU32 numbering. Calling SU24 @ 433.500 MHz.',
    defaultForbidTransmit: false,
    defaultBandwidthKHz: 12.5,
    templates: ukUhfSimplexLegacyTemplates,
  },
  {
    id: 'uk-cb-2781',
    label: 'UK CB (27/81)',
    description: '40 UK Citizen Band channels (27.60125–27.99125 MHz).',
    defaultForbidTransmit: false,
    defaultBandwidthKHz: 12.5,
    templates: ukCb2781Templates,
  },
  {
    id: 'eu-cb-cept',
    label: 'EU / CEPT CB',
    description: '40 CEPT CB channels (26.965–27.405 MHz).',
    defaultForbidTransmit: false,
    defaultBandwidthKHz: 12.5,
    templates: euCbCeptTemplates,
  },
];

const definitionById = new Map<ChannelSetId, ChannelSetDefinition>(
  CHANNEL_SET_DEFINITIONS.map((def) => [def.id, def]),
);

export function channelSetDefinition(id: ChannelSetId): ChannelSetDefinition {
  const def = definitionById.get(id);
  if (!def) {
    throw new Error(`Unknown channel set: ${id}`);
  }
  return def;
}

export function allChannelSetIds(): ChannelSetId[] {
  return CHANNEL_SET_DEFINITIONS.map((def) => def.id);
}

import type { Channel } from '../../models/library.ts';

export type ChannelSetId =
  | 'pmr446'
  | 'uk-vhf-simplex-v'
  | 'uk-vhf-simplex-s'
  | 'uk-uhf-simplex-u'
  | 'uk-uhf-simplex-s'
  | 'uk-cb-2781'
  | 'eu-cb-cept';

export interface ChannelSetTemplate {
  name: string;
  rxFrequencyHz: number;
  txFrequencyHz: number;
}

export interface ChannelSetDefinition {
  id: ChannelSetId;
  label: string;
  description: string;
  defaultForbidTransmit: boolean;
  defaultBandwidthKHz: number;
  templates: () => ChannelSetTemplate[];
}

export interface ChannelSetGenerateOptions {
  /** Prepended to each generated channel name when non-empty. */
  namePrefix?: string;
  power?: number | null;
  forbidTransmit?: boolean;
  /** FM channel bandwidth in kHz; defaults to the set definition (12.5). */
  bandwidthKHz?: number;
}

export interface ChannelSetDedupResult {
  toAdd: Channel[];
  skippedByRxHz: Channel[];
  skippedByName: Channel[];
}

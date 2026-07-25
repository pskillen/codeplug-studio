import type { ChannelMode } from '@core/models/libraryTypes.ts';

/** One supported RX band for a radio target. `txAllowed: false` is display metadata only. */
export interface RadioFrequencyRange {
  minMhz: number;
  maxMhz: number;
  modes: readonly ChannelMode[];
  /** When false, label as receive-only on Radio characteristics (not used for eligibility TX inference). */
  txAllowed?: boolean;
}

export interface RadioRfCapabilities {
  radioTargetId: string;
  supportedModes: readonly ChannelMode[];
  frequencyRanges: readonly RadioFrequencyRange[];
}

function range(
  minMhz: number,
  maxMhz: number,
  modes: readonly ChannelMode[],
  txAllowed = true,
): RadioFrequencyRange {
  return txAllowed === false ? { minMhz, maxMhz, modes, txAllowed: false } : { minMhz, maxMhz, modes };
}

const UV5R_MINI: RadioRfCapabilities = {
  radioTargetId: 'baofeng-uv5r-mini',
  supportedModes: ['fm', 'am'],
  frequencyRanges: [
    range(108, 135.999999, ['am']),
    range(136, 174, ['fm']),
    range(350, 390, ['fm'], false),
    range(400, 480, ['fm']),
    range(480, 520, ['fm'], false),
  ],
};

const UV21: RadioRfCapabilities = {
  radioTargetId: 'baofeng-uv21',
  supportedModes: ['fm', 'am'],
  frequencyRanges: [
    range(108, 135.999999, ['am']),
    range(136, 174, ['fm']),
    range(220, 260, ['fm']),
    range(350, 390, ['fm'], false),
    range(400, 479.999999, ['fm']),
    range(480, 520, ['fm'], false),
  ],
};

const RT95: RadioRfCapabilities = {
  radioTargetId: 'retevis-rt95',
  supportedModes: ['fm'],
  frequencyRanges: [range(136, 174, ['fm']), range(400, 490, ['fm'])],
};

const DM32UV: RadioRfCapabilities = {
  radioTargetId: 'baofeng-dm32uv',
  supportedModes: ['fm', 'dmr'],
  frequencyRanges: [
    range(136, 174, ['fm', 'dmr']),
    range(400, 480, ['fm', 'dmr']),
    range(87, 136, ['fm', 'am'], false),
  ],
};

const DM1701_BANDS: readonly RadioFrequencyRange[] = [
  range(136, 174, ['fm', 'dmr']),
  range(400, 470, ['fm', 'dmr']),
];

const DM1701: RadioRfCapabilities = {
  radioTargetId: 'baofeng-dm1701',
  supportedModes: ['fm', 'dmr'],
  frequencyRanges: DM1701_BANDS,
};

const MD9600: RadioRfCapabilities = {
  radioTargetId: 'tyt-md9600',
  supportedModes: ['fm', 'dmr'],
  frequencyRanges: DM1701_BANDS,
};

const AT_D890UV: RadioRfCapabilities = {
  radioTargetId: 'anytone-at-d890uv',
  supportedModes: ['fm', 'am', 'dmr'],
  frequencyRanges: [
    range(136, 174, ['fm', 'dmr']),
    range(400, 480, ['fm', 'dmr']),
    range(108, 136, ['am']),
    range(87.5, 108, ['fm'], false),
  ],
};

/** Authoritative RF capability tables keyed by {@link RadioTarget.id}. */
export const RADIO_RF_CAPABILITIES: Record<string, RadioRfCapabilities> = {
  'baofeng-uv5r-mini': UV5R_MINI,
  'baofeng-uv21': UV21,
  'retevis-rt95': RT95,
  'baofeng-dm32uv': DM32UV,
  'baofeng-dm1701': DM1701,
  'tyt-md9600': MD9600,
  'anytone-at-d890uv': AT_D890UV,
};

export function getRadioRfCapabilities(radioTargetId: string): RadioRfCapabilities | undefined {
  return RADIO_RF_CAPABILITIES[radioTargetId];
}

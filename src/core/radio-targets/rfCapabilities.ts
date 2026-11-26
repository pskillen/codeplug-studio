import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { DM1701_RADIOFOUNDRY_BOARD } from '@core/radios/baofeng/dm-1701-radiofoundry/limits.ts';
import { RT84_RADIOFOUNDRY_BOARD } from '@core/radios/retevis/rt84-radiofoundry/limits.ts';
import { MD9600_RADIOFOUNDRY_BOARD } from '@core/radios/tyt/md-9600-radiofoundry/limits.ts';
import { RT90_RADIOFOUNDRY_BOARD } from '@core/radios/retevis/rt90-radiofoundry/limits.ts';
import { DM32UV_RADIOFOUNDRY_BOARD } from '@core/radios/baofeng/dm-32uv-radiofoundry/limits.ts';
import type { RadioFoundryBoardLimits } from '@core/radios/radiofoundry/limits.ts';

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
  return txAllowed === false
    ? { minMhz, maxMhz, modes, txAllowed: false }
    : { minMhz, maxMhz, modes };
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

const UV5R_MINI_MM9PDY: RadioRfCapabilities = {
  ...UV5R_MINI,
  radioTargetId: 'baofeng-uv5r-mini-mm9pdy',
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

const RT95_MM9PDY: RadioRfCapabilities = { ...RT95, radioTargetId: 'retevis-rt95-mm9pdy' };

const DM32UV: RadioRfCapabilities = {
  radioTargetId: 'baofeng-dm32uv',
  supportedModes: ['fm', 'am', 'dmr'],
  frequencyRanges: [
    range(136, 174, ['fm', 'dmr']),
    range(400, 480, ['fm', 'dmr']),
    range(87, 136, ['fm', 'am'], false),
  ],
};

/** RadioFoundry: FM, conventional DMR and M17 on the board's bands, transmit allowed. */
function radioFoundryRf(
  radioTargetId: string,
  board: RadioFoundryBoardLimits,
): RadioRfCapabilities {
  const modes = ['fm', 'dmr', 'm17'] as const;
  return {
    radioTargetId,
    supportedModes: modes,
    frequencyRanges: board.BANDS_HZ.map((band) =>
      range(band.minHz / 1_000_000, band.maxHz / 1_000_000, modes),
    ),
  };
}

const DM32UV_RADIOFOUNDRY = radioFoundryRf(
  'baofeng-dm32uv-radiofoundry',
  DM32UV_RADIOFOUNDRY_BOARD,
);

const DM1701_RADIOFOUNDRY = radioFoundryRf(
  'baofeng-dm1701-radiofoundry',
  DM1701_RADIOFOUNDRY_BOARD,
);

const RT84_RADIOFOUNDRY = radioFoundryRf('retevis-rt84-radiofoundry', RT84_RADIOFOUNDRY_BOARD);

const MD9600_RADIOFOUNDRY = radioFoundryRf('tyt-md9600-radiofoundry', MD9600_RADIOFOUNDRY_BOARD);

const RT90_RADIOFOUNDRY = radioFoundryRf('retevis-rt90-radiofoundry', RT90_RADIOFOUNDRY_BOARD);

const DM32UV_MM9PDY: RadioRfCapabilities = {
  radioTargetId: 'baofeng-dm32uv-mm9pdy',
  supportedModes: ['fm', 'am', 'dmr'],
  frequencyRanges: DM32UV.frequencyRanges,
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

const AT_D890UV_BANDS: readonly RadioFrequencyRange[] = [
  range(136, 174, ['fm', 'dmr']),
  range(400, 480, ['fm', 'dmr']),
  range(108, 136, ['am']),
  range(87.5, 108, ['fm'], false),
];

const AT_D890UV: RadioRfCapabilities = {
  radioTargetId: 'anytone-at-d890uv',
  supportedModes: ['fm', 'am', 'dmr'],
  frequencyRanges: AT_D890UV_BANDS,
};

/**
 * MM9PDY adds NXDN on the two VHF/UHF voice bands. Whether a given Write carries it depends on the
 * radio reporting NXDN enabled (see the AT-D890 NXDN reference); eligibility only says the target can.
 */
const AT_D890UV_MM9PDY_BANDS: readonly RadioFrequencyRange[] = [
  range(136, 174, ['fm', 'dmr', 'nxdn']),
  range(400, 480, ['fm', 'dmr', 'nxdn']),
  range(108, 136, ['am']),
  range(87.5, 108, ['fm'], false),
];

const AT_D890UV_MM9PDY: RadioRfCapabilities = {
  radioTargetId: 'anytone-at-d890uv-mm9pdy',
  supportedModes: ['fm', 'am', 'dmr', 'nxdn'],
  frequencyRanges: AT_D890UV_MM9PDY_BANDS,
};

/** Authoritative RF capability tables keyed by {@link RadioTarget.id}. */
export const RADIO_RF_CAPABILITIES: Record<string, RadioRfCapabilities> = {
  'baofeng-uv5r-mini': UV5R_MINI,
  'baofeng-uv5r-mini-mm9pdy': UV5R_MINI_MM9PDY,
  'baofeng-uv21': UV21,
  'retevis-rt84-radiofoundry': RT84_RADIOFOUNDRY,
  'retevis-rt90-radiofoundry': RT90_RADIOFOUNDRY,
  'retevis-rt95': RT95,
  'retevis-rt95-mm9pdy': RT95_MM9PDY,
  'baofeng-dm32uv': DM32UV,
  'baofeng-dm32uv-mm9pdy': DM32UV_MM9PDY,
  'baofeng-dm32uv-radiofoundry': DM32UV_RADIOFOUNDRY,
  'baofeng-dm1701': DM1701,
  'baofeng-dm1701-radiofoundry': DM1701_RADIOFOUNDRY,
  'tyt-md9600': MD9600,
  'tyt-md9600-radiofoundry': MD9600_RADIOFOUNDRY,
  'anytone-at-d890uv': AT_D890UV,
  'anytone-at-d890uv-mm9pdy': AT_D890UV_MM9PDY,
};

export function getRadioRfCapabilities(radioTargetId: string): RadioRfCapabilities | undefined {
  return RADIO_RF_CAPABILITIES[radioTargetId];
}

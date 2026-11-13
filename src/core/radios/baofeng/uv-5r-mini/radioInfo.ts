/**
 * The UV-5R Mini's flash layout from its Radio Info screen, for a radio with no radio report (stock firmware, or an
 * MM9PDY build from before the report). The suffix (`NRF`, `NRFB`) and the Firmware version together name the radio's
 * stock base, the code base every file for it is built on (a radio's code base never changes, and NRF and NRFB radios
 * get separate builds): `NRFB V0.04` is `nrfb-v0.04` (flash layout `L1`), `NRF V0.27` is `nrf-v0.27` (`L2`). Any other
 * combination has no build. The Hardware line is the board version, asked only so that a board Studio hasn't seen
 * proven is refused. All three lines are dropdowns of the supported values; `Other` is refused.
 */
import type {
  FirmwareRadioLayoutQuestion,
  RadioInfoAnswers,
  RadioLayoutAnswer,
} from '../../../firmware/types.ts';
import { decodeUv5rMiniRadioReport, uv5rMiniLayoutFromReport } from './radioReport.ts';

export const UV5RMINI_RADIO_INFO_REFUSAL =
  "Studio hasn't been proven on this radio's Hardware version; nothing was sent.";

export const UV5RMINI_FIRMWARE_NOT_SUPPORTED =
  "Studio doesn't support this radio's Firmware version; nothing was sent.";

/** The pick for a line whose value isn't listed. */
export const UV5RMINI_RADIO_INFO_OTHER = 'Other';

/** `v0.27`, `V 0.27` and `0.27` all read as `V0.27`. */
export function normaliseRadioInfoLine(line: string): string {
  const s = line.replace(/\s+/g, '').toUpperCase();
  if (s === '') return '';
  return s.startsWith('V') ? s : `V${s}`;
}

export const UV5RMINI_SUFFIX_NOT_SUPPORTED =
  "Studio doesn't support this radio's suffix; nothing was sent.";

/** A combination of suffix and Firmware line with no stock base: no build exists for it, and none is offered instead. */
export const UV5RMINI_NO_BUILD_FOR_RADIO = (suffix: string, firmware: string): string =>
  `There is no MM9PDY build for this radio (${suffix} ${firmware}) yet; nothing was sent.`;

/** The Firmware lines Studio lists. */
const FIRMWARE_LINES: readonly string[] = ['V0.04', 'V0.27'];
/** The suffixes Studio lists. */
const SUFFIXES: readonly string[] = ['NRF', 'NRFB'];

/**
 * The stock bases, by suffix and Firmware line, with the flash layout each one's radios have. A combination not here
 * has no build. The base names are the stock descriptor's `baseName`s.
 */
const BASES: Readonly<Record<string, { readonly base: string; readonly layout: 'L1' | 'L2' }>> = {
  'NRFB V0.04': { base: 'nrfb-v0.04', layout: 'L1' },
  'NRF V0.27': { base: 'nrf-v0.27', layout: 'L2' },
};

/** The Hardware lines an update has been proven on. */
const PROVEN_HARDWARE: readonly string[] = ['V1.7'];

export const UV5RMINI_FIRMWARE_OPTIONS: readonly string[] = [
  ...FIRMWARE_LINES,
  UV5RMINI_RADIO_INFO_OTHER,
];
export const UV5RMINI_SUFFIX_OPTIONS: readonly string[] = [...SUFFIXES, UV5RMINI_RADIO_INFO_OTHER];
export const UV5RMINI_HARDWARE_OPTIONS: readonly string[] = [
  ...PROVEN_HARDWARE,
  UV5RMINI_RADIO_INFO_OTHER,
];

/** The variant a base is for: its suffix (`nrf`, `nrfb`). NRF and NRFB radios get separate builds. */
export function uv5rMiniVariantOfBase(base: string): string | undefined {
  return /^(nrfb?)-/.exec(base)?.[1];
}

/**
 * Shown with the question. Accurate for the bases Studio knows: a pick that doesn't match the radio either has no
 * build (refused here) or names the other flash layout, which the loader refuses before installing anything, but the
 * stock update mode may already have reset the FM presets and volume by then.
 */
export const UV5RMINI_RADIO_INFO_WARNING =
  "Pick exactly what the radio shows. If what you pick doesn't match the radio, the radio refuses the file and nothing is installed, but its FM presets and volume may be reset.";

export function uv5rMiniLayoutFromRadioInfo(answers: RadioInfoAnswers): RadioLayoutAnswer {
  const firmware = normaliseRadioInfoLine(answers.firmware);
  const hardware = normaliseRadioInfoLine(answers.hardware);
  const suffix = (answers.suffix ?? '').replace(/\s+/g, '').toUpperCase();
  if (firmware === '' || hardware === '' || suffix === '') return { kind: 'incomplete' };
  if (!PROVEN_HARDWARE.includes(hardware)) {
    return { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL };
  }
  if (!FIRMWARE_LINES.includes(firmware)) {
    return { kind: 'refused', message: UV5RMINI_FIRMWARE_NOT_SUPPORTED };
  }
  if (!SUFFIXES.includes(suffix))
    return { kind: 'refused', message: UV5RMINI_SUFFIX_NOT_SUPPORTED };
  const hit = BASES[`${suffix} ${firmware}`];
  if (!hit) return { kind: 'refused', message: UV5RMINI_NO_BUILD_FOR_RADIO(suffix, firmware) };
  return { kind: 'layout', layout: hit.layout, codeBase: hit.base };
}

/** Where the Firmware and Hardware lines are. */
export const UV5RMINI_RADIO_INFO_HELP = 'From Radio Info (MENU → Radio Info).';

/** Where the suffix is: not on Radio Info, only on a start-up screen shown for about a second. */
export const UV5RMINI_SUFFIX_HELP =
  'Not on Radio Info. Switch the radio off, then hold 8 while switching it on: for about a second it shows 5RMINI NRF or 5RMINI NRFB, then boots normally. Repeat it, or film the screen with your phone, if you miss it.';

export const UV5RMINI_RADIO_LAYOUT_QUESTION: FirmwareRadioLayoutQuestion = {
  intro:
    "The UV-5R Mini's factory firmware is packed in one of two flash layouts, and each release has one file per layout, built for one firmware version and suffix. Three things the radio shows tell Studio which file is this radio's; Studio can't read them over the cable.",
  steps: [
    'Pick the Firmware and Hardware lines from the Radio Info screen (MENU → Radio Info).',
    'Pick the suffix from the start-up screen, as described under it.',
  ],
  firmwareLabel: 'Radio Info: Firmware',
  hardwareLabel: 'Radio Info: Hardware',
  suffixLabel: 'Suffix',
  firmwareHelp: UV5RMINI_RADIO_INFO_HELP,
  hardwareHelp: UV5RMINI_RADIO_INFO_HELP,
  suffixHelp: UV5RMINI_SUFFIX_HELP,
  firmwareOptions: UV5RMINI_FIRMWARE_OPTIONS,
  suffixOptions: UV5RMINI_SUFFIX_OPTIONS,
  hardwareOptions: UV5RMINI_HARDWARE_OPTIONS,
  warning: UV5RMINI_RADIO_INFO_WARNING,
  resolve: uv5rMiniLayoutFromRadioInfo,
  report: {
    intro:
      "The UV-5R Mini's factory firmware is packed in one of two flash layouts, and each release has one file per layout. Studio reads the radio to find out which one it has. The read writes nothing.",
    steps: [
      'Switch the radio on normally (not in update mode) and connect the programming cable.',
      "Choose Read the radio and pick the cable's port.",
    ],
    resolve: (bytes) => uv5rMiniLayoutFromReport(decodeUv5rMiniRadioReport(bytes)),
  },
};

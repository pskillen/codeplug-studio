/**
 * The UV-5R Mini's flash layout from its screens, for a radio with no radio report (stock firmware, or an MM9PDY
 * build from before the report). Studio does not ask Radio Info's Firmware line: it sends the L1 file first
 * (`uv5rMiniFirstInstallBase`) and the other layout's file if the radio refuses it. The suffix (`NRF`, `NRFB`) is
 * still asked, and refused when it is not one Studio lists. The Hardware line is the board version, asked only so
 * that a board Studio hasn't seen proven is refused. Both are dropdowns of the supported values; `Other` is refused.
 * The bases and the proven Hardware lines are `stockBases.ts`'s, the table the radio report uses too. A radio that
 * reports itself is still matched by suffix and Firmware line in that table.
 */
import type {
  FirmwareRadioLayoutQuestion,
  RadioInfoAnswers,
  RadioLayoutAnswer,
} from '../../../firmware/types.ts';
import { decodeUv5rMiniRadioReport, uv5rMiniLayoutFromReport } from './radioReport.ts';
import {
  isUv5rMiniHardwareProven,
  UV5RMINI_NO_BUILD_FOR_RADIO,
  UV5RMINI_PROVEN_HARDWARE,
  UV5RMINI_RADIO_INFO_REFUSAL,
  uv5rMiniFirstInstallBase,
} from './stockBases.ts';

export { UV5RMINI_NO_BUILD_FOR_RADIO, UV5RMINI_RADIO_INFO_REFUSAL };

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

/** The suffixes Studio lists. */
const SUFFIXES: readonly string[] = ['NRF', 'NRFB'];

export const UV5RMINI_SUFFIX_OPTIONS: readonly string[] = [...SUFFIXES, UV5RMINI_RADIO_INFO_OTHER];
export const UV5RMINI_HARDWARE_OPTIONS: readonly string[] = [
  ...UV5RMINI_PROVEN_HARDWARE,
  UV5RMINI_RADIO_INFO_OTHER,
];

/** The variant a base is for: its suffix (`nrf`, `nrfb`). NRF and NRFB radios get separate builds. */
export function uv5rMiniVariantOfBase(base: string): string | undefined {
  return /^(nrfb?)-/.exec(base)?.[1];
}

/**
 * Shown with the question. A suffix or Hardware line Studio doesn't list stops the update. Studio does not ask the
 * Firmware line: it sends the L1 file, then the other file if the radio refuses the first.
 */
export const UV5RMINI_RADIO_INFO_WARNING =
  'Pick the suffix and Hardware line the radio shows. An unknown suffix or Hardware line stops the update. Studio sends one file first and, if the radio refuses it, sends the other.';

export function uv5rMiniLayoutFromRadioInfo(answers: RadioInfoAnswers): RadioLayoutAnswer {
  const hardware = normaliseRadioInfoLine(answers.hardware);
  const suffix = (answers.suffix ?? '').replace(/\s+/g, '').toUpperCase();
  if (hardware === '' || suffix === '') return { kind: 'incomplete' };
  if (!isUv5rMiniHardwareProven(hardware)) {
    return { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL };
  }
  if (!SUFFIXES.includes(suffix))
    return { kind: 'refused', message: UV5RMINI_SUFFIX_NOT_SUPPORTED };
  const first = uv5rMiniFirstInstallBase();
  if (!first) return { kind: 'refused', message: UV5RMINI_SUFFIX_NOT_SUPPORTED };
  return { kind: 'layout', layout: first.layout, codeBase: first.base };
}

/** Where the Firmware and Hardware lines are. */
export const UV5RMINI_RADIO_INFO_HELP = 'From Radio Info (MENU → Radio Info).';

/** Where the suffix is: not on Radio Info, only on a start-up screen shown for about a second. */
export const UV5RMINI_SUFFIX_HELP =
  'Not on Radio Info. Switch the radio off, then hold 8 while switching it on: for about a second it shows 5RMINI NRF or 5RMINI NRFB, then boots normally. Repeat it, or film the screen with your phone, if you miss it.';

export const UV5RMINI_RADIO_LAYOUT_QUESTION: FirmwareRadioLayoutQuestion = {
  intro:
    'Each UV-5R Mini firmware gets its own releases. Studio reads the radio when it can. On a stock radio it asks for the suffix and the Hardware line, then sends one file and the other if the radio refuses the first.',
  steps: [
    'Pick the Hardware line from the Radio Info screen (MENU → Radio Info).',
    'Pick the suffix from the start-up screen, as described under it.',
  ],
  omitFirmwareLine: true,
  firmwareLabel: 'Radio Info: Firmware',
  hardwareLabel: 'Radio Info: Hardware',
  suffixLabel: 'Suffix',
  hardwareHelp: UV5RMINI_RADIO_INFO_HELP,
  suffixHelp: UV5RMINI_SUFFIX_HELP,
  suffixOptions: UV5RMINI_SUFFIX_OPTIONS,
  hardwareOptions: UV5RMINI_HARDWARE_OPTIONS,
  warning: UV5RMINI_RADIO_INFO_WARNING,
  resolve: uv5rMiniLayoutFromRadioInfo,
  report: {
    intro:
      "Each UV-5R Mini firmware gets its own releases. Studio reads the radio to find out your radio's firmware, so it offers only the releases built for it. The read writes nothing.",
    steps: [
      'Switch the radio on normally (not in update mode) and connect the programming cable.',
      "Choose Read the radio and pick the cable's port.",
    ],
    resolve: (bytes) => uv5rMiniLayoutFromReport(decodeUv5rMiniRadioReport(bytes)),
  },
};

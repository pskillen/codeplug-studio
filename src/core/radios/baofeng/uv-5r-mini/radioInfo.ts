/**
 * The UV-5R Mini's flash layout from its Radio Info screen, for a radio with no radio report (stock firmware, or an
 * MM9PDY build from before the report). `L1` and `L2` are the factory firmware's flash packing, not the board: the
 * Firmware line decides it (`V0.04` is `L1`, `V0.27` is `L2`), and with it the code base every file for that radio is
 * built on, since a radio's code base never changes. The Hardware line is the board variant, a separate thing; it is
 * asked only so that a board Studio hasn't seen proven is refused. Both lines are dropdowns of the supported values;
 * `Other` is refused.
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

/** The Firmware lines Studio supports, by flash layout. */
const LAYOUT_BY_FIRMWARE: Readonly<Record<string, 'L1' | 'L2'>> = {
  'V0.04': 'L1',
  'V0.27': 'L2',
};

/** The Hardware lines an update has been proven on. */
const PROVEN_HARDWARE: readonly string[] = ['V1.7'];

export const UV5RMINI_FIRMWARE_OPTIONS: readonly string[] = [
  ...Object.keys(LAYOUT_BY_FIRMWARE),
  UV5RMINI_RADIO_INFO_OTHER,
];
export const UV5RMINI_HARDWARE_OPTIONS: readonly string[] = [
  ...PROVEN_HARDWARE,
  UV5RMINI_RADIO_INFO_OTHER,
];

/**
 * Shown with the question. Accurate: the loader refuses a file for the other layout before installing
 * anything, but the stock update mode may already have reset the FM presets and volume by then.
 */
export const UV5RMINI_RADIO_INFO_WARNING =
  "Pick exactly what the radio's Radio Info screen shows. If the Firmware line you pick doesn't match the radio, the radio refuses the file and nothing is installed, but its FM presets and volume may be reset.";

export function uv5rMiniLayoutFromRadioInfo(answers: RadioInfoAnswers): RadioLayoutAnswer {
  const firmware = normaliseRadioInfoLine(answers.firmware);
  const hardware = normaliseRadioInfoLine(answers.hardware);
  if (firmware === '' || hardware === '') return { kind: 'incomplete' };
  if (!PROVEN_HARDWARE.includes(hardware)) {
    return { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL };
  }
  const layout = LAYOUT_BY_FIRMWARE[firmware];
  if (!layout) return { kind: 'refused', message: UV5RMINI_FIRMWARE_NOT_SUPPORTED };
  return { kind: 'layout', layout };
}

export const UV5RMINI_RADIO_LAYOUT_QUESTION: FirmwareRadioLayoutQuestion = {
  intro:
    "The UV-5R Mini's factory firmware is packed in one of two flash layouts, and each release has one file per layout, built on that firmware. Its Radio Info screen tells Studio which one this radio has.",
  steps: [
    'Switch the radio on normally and open its Radio Info screen.',
    'Pick its Firmware and Hardware lines below, as shown there.',
  ],
  firmwareLabel: 'Radio Info: Firmware',
  hardwareLabel: 'Radio Info: Hardware',
  firmwareOptions: UV5RMINI_FIRMWARE_OPTIONS,
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

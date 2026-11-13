/**
 * The UV-5R Mini's flash layout from its Radio Info screen, for a radio with no radio report (stock firmware, or an
 * MM9PDY build from before the report). `L1` and `L2` are the factory firmware's flash packing, not the board: the
 * Firmware line decides it (`V0.04` is `L1`, anything else `L2`). The Hardware line is the board variant, a separate
 * thing; it is asked only so that a board Studio hasn't seen proven is refused.
 */
import type {
  FirmwareRadioLayoutQuestion,
  RadioInfoAnswers,
  RadioLayoutAnswer,
} from '../../../firmware/types.ts';
import { decodeUv5rMiniRadioReport, uv5rMiniLayoutFromReport } from './radioReport.ts';

export const UV5RMINI_RADIO_INFO_REFUSAL =
  "Studio hasn't been proven on this radio's Hardware version; nothing was sent.";

/** `v0.27`, `V 0.27` and `0.27` all read as `V0.27`. */
export function normaliseRadioInfoLine(line: string): string {
  const s = line.replace(/\s+/g, '').toUpperCase();
  if (s === '') return '';
  return s.startsWith('V') ? s : `V${s}`;
}

/** The Hardware lines an update has been proven on. */
const PROVEN_HARDWARE: readonly string[] = ['V1.7'];

/** The Firmware line of the factory firmware packed as layout 1; every other line is layout 2. */
const L1_FIRMWARE = 'V0.04';

export function uv5rMiniLayoutFromRadioInfo(answers: RadioInfoAnswers): RadioLayoutAnswer {
  const firmware = normaliseRadioInfoLine(answers.firmware);
  const hardware = normaliseRadioInfoLine(answers.hardware);
  if (firmware === '' || hardware === '') return { kind: 'incomplete' };
  if (!PROVEN_HARDWARE.includes(hardware)) {
    return { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL };
  }
  return { kind: 'layout', layout: firmware === L1_FIRMWARE ? 'L1' : 'L2' };
}

export const UV5RMINI_RADIO_LAYOUT_QUESTION: FirmwareRadioLayoutQuestion = {
  intro:
    "The UV-5R Mini's factory firmware is packed in one of two flash layouts, and each release has one file per layout. Its Radio Info screen tells Studio which one this radio has.",
  steps: [
    'Switch the radio on normally and open its Radio Info screen.',
    'Type its Firmware and Hardware lines below, as shown.',
  ],
  firmwareLabel: 'Radio Info: Firmware',
  hardwareLabel: 'Radio Info: Hardware',
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

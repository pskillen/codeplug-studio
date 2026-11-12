/**
 * The UV-5R Mini's hardware layout from the two lines of its Radio Info screen, `Firmware` and `Hardware`. Only the
 * pairs proven on a radio map to a layout; anything else is refused. A radio moved from V0.04 to V0.27 shows V0.27 but
 * keeps layout 1, so the operator can say so explicitly.
 */
import type {
  FirmwareRadioLayoutQuestion,
  RadioInfoAnswers,
  RadioLayoutAnswer,
} from '../../../firmware/types.ts';

export const UV5RMINI_RADIO_INFO_REFUSAL =
  "Studio doesn't recognise this radio's Radio Info; nothing was sent.";

/** `v0.27`, `V 0.27` and `0.27` all read as `V0.27`. */
export function normaliseRadioInfoLine(line: string): string {
  const s = line.replace(/\s+/g, '').toUpperCase();
  if (s === '') return '';
  return s.startsWith('V') ? s : `V${s}`;
}

/** The proven pairs: Hardware V1.7 with Firmware V0.04 (layout 1) or V0.27 (layout 2). */
const PAIRS: Readonly<Record<string, string>> = {
  'V0.04/V1.7': 'L1',
  'V0.27/V1.7': 'L2',
};

export function uv5rMiniLayoutFromRadioInfo(answers: RadioInfoAnswers): RadioLayoutAnswer {
  const firmware = normaliseRadioInfoLine(answers.firmware);
  const hardware = normaliseRadioInfoLine(answers.hardware);
  if (firmware === '' || hardware === '') return { kind: 'incomplete' };
  const layout = PAIRS[`${firmware}/${hardware}`];
  if (!layout) return { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL };
  // The override only re-labels a proven pair: a radio moved to v0.27 shows the layout-2 pair but is layout 1.
  return { kind: 'layout', layout: answers.override ? 'L1' : layout };
}

export const UV5RMINI_RADIO_LAYOUT_QUESTION: FirmwareRadioLayoutQuestion = {
  intro:
    'The UV-5R Mini comes in two hardware layouts, and each release has one file per layout. Tell Studio which one this radio has.',
  steps: [
    'Switch the radio on normally and open its Radio Info screen.',
    'Type its Firmware and Hardware lines below, as shown.',
  ],
  firmwareLabel: 'Radio Info: Firmware',
  hardwareLabel: 'Radio Info: Hardware',
  override: {
    label: 'My radio is layout 1 (it was moved to v0.27)',
    help: 'Only if this radio was moved from V0.04 to V0.27 by an MM9PDY update. A wrong choice is refused by the radio, but its FM presets and volume are reset.',
  },
  resolve: uv5rMiniLayoutFromRadioInfo,
};

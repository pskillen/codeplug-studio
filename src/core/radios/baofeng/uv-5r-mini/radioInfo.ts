/**
 * The UV-5R Mini's hardware layout from its Radio Info screen: the `Firmware` and `Hardware` lines, and on a radio
 * running an MM9PDY build, the build name on the fourth line. Only the pairs proven on a radio map to a layout;
 * anything else is refused. The Firmware line is the vendor's text, which an MM9PDY build never changes, so a radio
 * moved from V0.04 to V0.27 shows V0.27 but keeps layout 1: its build name says so, or the operator says so explicitly.
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

/** The screen holds 21 characters; the firmware refuses a longer name rather than cutting it. */
const BUILD_NAME_MAX = 21;
const SEMVER = String.raw`\d+\.\d+\.\d+(?:-rc\.\d+)?`;
const PR = String.raw`pr[1-9]\d*`;
/** Current names carry the layout: release, PR build (hash trimmed to 4–7 digits) and ad hoc. */
const TAGGED = new RegExp(
  String.raw`^mm9pdy-(L1|L2)-(?:${SEMVER}|${PR}-g[0-9a-f]{4,7}|g[0-9a-f]{4,7}(?:-dirty)?)$`,
  'i',
);
/** Names from before the layout tag: release, PR build (hash optional at first) and ad hoc. */
const UNTAGGED = new RegExp(
  String.raw`^mm9pdy-(?:${SEMVER}|${PR}(?:-g[0-9a-f]{4,7})?|g[0-9a-f]{7}(?:-dirty)?)$`,
  'i',
);

export interface Uv5rMiniBuildName {
  readonly layout: 'L1' | 'L2';
  /** False for the names from before the layout tag, which were all built for V0.04. */
  readonly tagged: boolean;
}

/**
 * The layout an MM9PDY build name was built for: `mm9pdy-L1-…` and `mm9pdy-L2-…` say so, and the untagged names from
 * before the tag are layout 1. Anything else, the bare unstamped `mm9pdy` included, is null. Case is ignored (users type what
 * the LCD shows, and phones capitalise); every other character counts, and surrounding spaces are dropped.
 */
export function parseUv5rMiniBuildName(name: string): Uv5rMiniBuildName | null {
  const s = name.trim();
  if (s.length > BUILD_NAME_MAX) return null;
  const tagged = TAGGED.exec(s);
  if (tagged) return { layout: tagged[1]!.toUpperCase() as 'L1' | 'L2', tagged: true };
  return UNTAGGED.test(s) ? { layout: 'L1', tagged: false } : null;
}

const REFUSED: RadioLayoutAnswer = { kind: 'refused', message: UV5RMINI_RADIO_INFO_REFUSAL };

export function uv5rMiniLayoutFromRadioInfo(answers: RadioInfoAnswers): RadioLayoutAnswer {
  const firmware = normaliseRadioInfoLine(answers.firmware);
  const hardware = normaliseRadioInfoLine(answers.hardware);
  if (firmware === '' || hardware === '') return { kind: 'incomplete' };
  const pairLayout = PAIRS[`${firmware}/${hardware}`];
  if (!pairLayout) return REFUSED;
  if (answers.build.trim() !== '') {
    // The build name was stamped for the layout read from the radio's own flash, so it decides.
    const build = parseUv5rMiniBuildName(answers.build);
    if (!build) return REFUSED;
    // Answers that contradict each other are refused: an L2 build runs only on V0.27, an untagged one only ever ran
    // on V0.04, and the override can only mean layout 1.
    if (build.layout === 'L2' && (firmware !== 'V0.27' || answers.override)) return REFUSED;
    if (!build.tagged && firmware !== 'V0.04') return REFUSED;
    return { kind: 'layout', layout: build.layout };
  }
  // The override only re-labels a proven pair: a radio moved to v0.27 shows the layout-2 pair but is layout 1.
  return { kind: 'layout', layout: answers.override ? 'L1' : pairLayout };
}

export const UV5RMINI_RADIO_LAYOUT_QUESTION: FirmwareRadioLayoutQuestion = {
  intro:
    'The UV-5R Mini comes in two hardware layouts, and each release has one file per layout. Tell Studio which one this radio has.',
  steps: [
    'Switch the radio on normally and open its Radio Info screen.',
    'Type its Firmware and Hardware lines below, as shown, and the MM9PDY build name if it shows one.',
  ],
  firmwareLabel: 'Radio Info: Firmware',
  hardwareLabel: 'Radio Info: Hardware',
  build: {
    label: 'Radio Info: MM9PDY build (if shown)',
    help: 'A radio running an MM9PDY build shows its name on the fourth line, such as mm9pdy-L1-1.0.0. Type it exactly; leave this empty on stock firmware.',
  },
  override: {
    label: 'My radio is layout 1 (it was moved to v0.27)',
    help: 'Only if this radio was moved from V0.04 to V0.27 by an MM9PDY update. A wrong choice is refused by the radio, but its FM presets and volume are reset.',
  },
  resolve: uv5rMiniLayoutFromRadioInfo,
};

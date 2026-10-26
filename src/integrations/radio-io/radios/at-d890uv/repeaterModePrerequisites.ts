/**
 * AT-D890UV repeater mode: the settings the radio checks before it keeps repeater mode on (#1393).
 *
 * At start-up the firmware switches repeater mode (`+0x143`) off in RAM unless Sub-Channel Mode is
 * on, the NOAA alert is off, and the AM/FM function is not FM radio. It also needs both start-up
 * channels to be DMR, or A and B to be on different bands (split at 300 MHz); that depends on the
 * codeplug and the zones the radio boots on, so it cannot be checked from settings alone. The NOAA
 * monitor byte is cleared by the settings load while repeater mode is set, so it never refuses.
 *
 * None of these bytes is a field Studio registers (the AM/FM byte is radio state, refused by the
 * allow-list), so they are read from the snapshot and only ever reported, never patched.
 * Pure; no I/O. Field reference: docs/reference/radios/anytone/at-d890uv/optional-settings.md.
 */

/** Offsets inside the optional-settings main record. */
const SUB_CHANNEL_MODE = 0x2d;
const NOAA_ALERT = 0xef;
const AM_FM_FUNCTION = 0x21;
/** `AM_FM_FUNCTION` value for FM broadcast radio. */
const AM_FM_FUNCTION_FM_RADIO = 1;

/** The raw bytes the radio's repeater-mode check reads from the settings record. */
export interface AtD890RepeaterBootBytes {
  readonly subChannelMode: number;
  readonly noaaAlert: number;
  readonly amFmFunction: number;
}

export type AtD890RepeaterPrerequisiteId = 'subChannelMode' | 'noaaAlert' | 'fmRadio';

export interface AtD890RepeaterPrerequisiteProblem {
  readonly id: AtD890RepeaterPrerequisiteId;
  /** User terms, no trailing full stop: "Sub-Channel Mode is off". */
  readonly text: string;
}

/** The bytes of the check from a `0x200`-byte main record; `undefined` when it is too short. */
export function atD890RepeaterBootBytes(main: Uint8Array): AtD890RepeaterBootBytes | undefined {
  if (main.length <= NOAA_ALERT) return undefined;
  return {
    subChannelMode: main[SUB_CHANNEL_MODE]!,
    noaaAlert: main[NOAA_ALERT]!,
    amFmFunction: main[AM_FM_FUNCTION]!,
  };
}

/** The prerequisites the settings fail, in the order the firmware checks them. */
export function atD890RepeaterPrerequisiteProblems(
  bytes: AtD890RepeaterBootBytes,
): AtD890RepeaterPrerequisiteProblem[] {
  const out: AtD890RepeaterPrerequisiteProblem[] = [];
  if (bytes.subChannelMode === 0) {
    out.push({ id: 'subChannelMode', text: 'Sub-Channel Mode is off' });
  }
  if (bytes.noaaAlert !== 0) {
    out.push({ id: 'noaaAlert', text: 'NOAA alert is on' });
  }
  if (bytes.amFmFunction === AM_FM_FUNCTION_FM_RADIO) {
    out.push({ id: 'fmRadio', text: 'AM/FM function is set to FM radio' });
  }
  return out;
}

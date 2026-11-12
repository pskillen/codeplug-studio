/**
 * RT95 firmware target profiles. The bootloader protocol (frames, echo, handshake, timeouts) is shared by both MCUs;
 * what differs per target is the address window, the stack-pointer rule, the model-string offset, an optional frame
 * cap and the refusal copy. The interlocks and the updater take a profile and read these facts from it.
 * Human mirror: docs/reference/radios/retevis/rt95/firmware.md — "Hard interlocks".
 */
import type { FirmwareRadioId } from '@core/firmware/types.ts';

import {
  RT95_HEAD_FW_LIMIT,
  RT95_HEAD_FW_MODEL_OFFSET,
  RT95_HEAD_FW_RADIO_ID,
  RT95_HEAD_FW_SP_MAX,
  RT95_HEAD_FW_SP_MIN,
} from './constants.ts';

export interface Rt95FirmwareTarget {
  readonly radioId: FirmwareRadioId;
  /** Short name of the MCU, e.g. 'RT95 front panel'. */
  readonly label: string;
  /** First address never written. */
  readonly limit: number;
  /** Optional cap on data frames in one package. */
  readonly maxFrames?: number;
  /** Initial-SP rule. `range`: an SP at or below `minExclusive` is the other target's image. */
  readonly sp:
    | { readonly kind: 'range'; readonly minExclusive: number; readonly maxInclusive: number }
    | { readonly kind: 'exact'; readonly value: number };
  /** `.CDD` offset of the `RT95-P\0` model string. */
  readonly modelOffset: number;
  readonly copy: {
    /** Shown when the image's SP says it belongs to the other MCU. */
    readonly otherTargetImage: string;
    readonly notThisTarget: string;
    readonly vectorTable: (sp: string, reset: string) => string;
    readonly model: string;
    readonly notInUpdateMode: string;
    readonly normalMode: string;
    /** Shown when the package has more data frames than `maxFrames`. */
    readonly tooManyFrames?: (frames: number, max: number) => string;
  };
}

export const RT95_HEAD_TARGET: Rt95FirmwareTarget = {
  radioId: RT95_HEAD_FW_RADIO_ID,
  label: 'RT95 front panel',
  limit: RT95_HEAD_FW_LIMIT,
  sp: { kind: 'range', minExclusive: RT95_HEAD_FW_SP_MIN, maxInclusive: RT95_HEAD_FW_SP_MAX },
  modelOffset: RT95_HEAD_FW_MODEL_OFFSET,
  copy: {
    otherTargetImage: 'This is a main-board image. Studio only flashes the RT95 front panel.',
    notThisTarget: 'This firmware image is not for the RT95 front panel.',
    vectorTable: (sp, reset) =>
      `The firmware vector table does not look like the RT95 front panel (SP ${sp}, reset ${reset}).`,
    model:
      'The firmware image does not carry the RT95-P model string where the front panel expects it.',
    notInUpdateMode:
      "The radio didn't answer. Is it in update mode? Hold P1 and the knob while switching on; the screen stays blank.",
    normalMode:
      'The radio is switched on normally, not in update mode. Nothing was written. Switch it off, then hold P1 and the knob while switching on; the screen stays blank.',
  },
};

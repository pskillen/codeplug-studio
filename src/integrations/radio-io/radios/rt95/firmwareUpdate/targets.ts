/**
 * RT95 firmware target profiles. The bootloader protocol (frames, echo, handshake, timeouts) is shared by both MCUs;
 * what differs per target is the address window, the stack-pointer rule, the model-string offset, an optional frame
 * cap and the refusal copy. The interlocks and the updater take a profile and read these facts from it.
 * Human mirror: docs/reference/radios/retevis/rt95/firmware.md — "Hard interlocks".
 */
import type { FirmwareRadioId, StockFirmwareDescriptor } from '@core/firmware/types.ts';
import { RT95_MAIN_STOCK_FIRMWARE } from '@core/radios/retevis/rt95/firmware.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { RadioInterlockError } from '../../../kit/errors.ts';
import { sha256HexSync } from '../../uv5r-mini/firmwareUpdate/sha256Sync.ts';
import {
  RT95_HEAD_FW_LIMIT,
  RT95_HEAD_FW_MODEL_OFFSET,
  RT95_HEAD_FW_RADIO_ID,
  RT95_HEAD_FW_SP_MAX,
  RT95_HEAD_FW_SP_MIN,
  RT95_MAIN_FW_LIMIT,
  RT95_MAIN_FW_MAX_FRAMES,
  RT95_MAIN_FW_MODEL_OFFSET,
  RT95_MAIN_FW_RADIO_ID,
  RT95_MAIN_FW_SP,
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
  /**
   * Target-specific image rule, run after the package checks. Throws RadioInterlockError. Code only: no flag turns
   * it off. MAIN: the pinned stock only (D35) until S3 widens it to the gated patched MAIN.
   */
  readonly checkImageIdentity?: (image: PreparedFirmwareImage) => void;
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

/**
 * MAIN image identity (this phase): stock only. Every pinned role's bytes, hashed here (not read from
 * `image.sha256`), equal the pinned stock member, and the image is stock. S3 widens this to "stock, or stock changed
 * only at the hook site and in the append window"; keep it, and `RT95_MAIN_TARGET`, in this one place.
 */
export function createRt95MainImageIdentityCheck(
  stock: StockFirmwareDescriptor,
): (image: PreparedFirmwareImage) => void {
  return (image) => {
    const refuse = () =>
      new RadioInterlockError(
        'Studio flashes only the pinned stock main-board firmware (MAIN V1.61) in this version.',
      );
    if (image.provenance !== 'stock') throw refuse();
    const files = image.package.files;
    for (const member of stock.members) {
      const bytes = files[member.role];
      if (!bytes || sha256HexSync(bytes) !== member.sha256) throw refuse();
    }
  };
}

export function createRt95MainTarget(
  stock: StockFirmwareDescriptor = RT95_MAIN_STOCK_FIRMWARE,
): Rt95FirmwareTarget {
  return {
    radioId: RT95_MAIN_FW_RADIO_ID,
    label: 'RT95 main board',
    limit: RT95_MAIN_FW_LIMIT,
    maxFrames: RT95_MAIN_FW_MAX_FRAMES,
    sp: { kind: 'exact', value: RT95_MAIN_FW_SP },
    modelOffset: RT95_MAIN_FW_MODEL_OFFSET,
    checkImageIdentity: createRt95MainImageIdentityCheck(stock),
    copy: {
      otherTargetImage:
        'This is a front-panel image. The main board takes only main-board firmware.',
      notThisTarget: 'This firmware image is not for the RT95 main board.',
      vectorTable: (sp, reset) =>
        `The firmware vector table does not look like the RT95 main board (SP ${sp}, reset ${reset}).`,
      model:
        'The firmware image does not carry the RT95-P model string where the main board expects it.',
      notInUpdateMode:
        "The radio didn't answer. Is the main board in update mode? Remove power (a Power-key off and on is not enough), hold P3 and the knob, restore power: the screen says UPDATE THE RF CPU.",
      normalMode:
        'The radio is switched on normally, not in update mode. Nothing was written. Remove power, then hold P3 and the knob while restoring power; the screen says UPDATE THE RF CPU.',
    },
  };
}

export const RT95_MAIN_TARGET: Rt95FirmwareTarget = createRt95MainTarget();

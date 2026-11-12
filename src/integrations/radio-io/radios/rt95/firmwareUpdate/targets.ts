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
  RT95_FW_CDI_LEN_OFFSET,
  RT95_FW_SPI_LEN_OFFSET,
  RT95_MAIN_FW_HOOK_END,
  RT95_MAIN_FW_HOOK_START,
  RT95_MAIN_FW_IMAGE_LEN,
  RT95_MAIN_FW_LIMIT,
  RT95_MAIN_FW_MAX_FRAMES,
  RT95_MAIN_FW_MODEL_OFFSET,
  RT95_MAIN_FW_RADIO_ID,
  RT95_MAIN_FW_SP,
  RT95_MAIN_FW_WINDOW_END,
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
    | {
        readonly kind: 'exact';
        readonly value: number;
        /** An SP in this range (> min, <= max) is the other target's image: `copy.otherTargetImage`. */
        readonly otherTargetRange?: {
          readonly minExclusive: number;
          readonly maxInclusive: number;
        };
      };
  /** `.CDD` offset of the `RT95-P\0` model string. */
  readonly modelOffset: number;
  /**
   * Target-specific image rule, run after the package checks. Throws RadioInterlockError. Code only: no flag turns
   * it off. MAIN: the pinned stock, or the pinned stock changed only at the D35 hook site and the append window.
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

const MAIN_REFUSE_STOCK_ONLY =
  'Studio flashes only the pinned stock main-board firmware (MAIN V1.61) in this version.';
const MAIN_REFUSE_CHANGES = 'This main-board image changes more than D35 allows.';

function sameBytes(a: Uint8Array, b: Uint8Array, from: number, to: number): boolean {
  for (let i = from; i < to; i++) if (a[i] !== b[i]) return false;
  return true;
}

function u32le(b: Uint8Array, off: number): number {
  return (b[off]! | (b[off + 1]! << 8) | (b[off + 2]! << 16) | (b[off + 3]! << 24)) >>> 0;
}

/** Bytes equal except the u32 length field at `off`, which must hold `len`. */
function equalButLength(image: Uint8Array, stock: Uint8Array, off: number, len: number): boolean {
  return (
    image.length === stock.length &&
    sameBytes(image, stock, 0, off) &&
    sameBytes(image, stock, off + 4, stock.length) &&
    u32le(image, off) === len
  );
}

/**
 * MAIN image identity, in this one place with `RT95_MAIN_TARGET`. Hashed here (not read from `image.sha256`).
 * Accepts the pinned stock as is, or a patched image built from the pinned stock (`stockPackage`) whose `.CDD` is
 * stock[0, 0xD93C) changed only at the D35 hook site [0x382, 0x386), then appended bytes up to the window end, and
 * whose `.CDI` / `.spi` differ from stock only in the length field. Repeats the patch format's rules on purpose
 * (defence in depth: a patch is untrusted input and never trusted).
 */
export function createRt95MainImageIdentityCheck(
  stock: StockFirmwareDescriptor,
): (image: PreparedFirmwareImage) => void {
  const pinned = (files: Readonly<Record<string, Uint8Array>>) =>
    stock.members.every((m) => {
      const bytes = files[m.role];
      return !!bytes && sha256HexSync(bytes) === m.sha256;
    });
  return (image) => {
    if (image.provenance === 'stock') {
      if (!pinned(image.package.files)) throw new RadioInterlockError(MAIN_REFUSE_STOCK_ONLY);
      return;
    }
    const refuse = () => new RadioInterlockError(MAIN_REFUSE_CHANGES);
    const base = image.stockPackage?.files;
    if (!base || !pinned(base)) throw refuse();
    const { cdd, cdi, spi } = image.package.files;
    const sCdd = base.cdd;
    if (
      !cdd ||
      !cdi ||
      !spi ||
      !sCdd ||
      !base.cdi ||
      !base.spi ||
      Object.keys(image.package.files).length !== 3 ||
      cdd.length < RT95_MAIN_FW_IMAGE_LEN ||
      cdd.length > RT95_MAIN_FW_WINDOW_END ||
      sCdd.length < RT95_MAIN_FW_IMAGE_LEN ||
      !sameBytes(cdd, sCdd, 0, RT95_MAIN_FW_HOOK_START) ||
      !sameBytes(cdd, sCdd, RT95_MAIN_FW_HOOK_END, RT95_MAIN_FW_IMAGE_LEN) ||
      !equalButLength(cdi, base.cdi, RT95_FW_CDI_LEN_OFFSET, cdd.length) ||
      !equalButLength(spi, base.spi, RT95_FW_SPI_LEN_OFFSET, cdd.length)
    ) {
      throw refuse();
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
    sp: {
      kind: 'exact',
      value: RT95_MAIN_FW_SP,
      // The head's SP range: a head image gets the plain-words refusal.
      otherTargetRange: { minExclusive: RT95_HEAD_FW_SP_MIN, maxInclusive: RT95_HEAD_FW_SP_MAX },
    },
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

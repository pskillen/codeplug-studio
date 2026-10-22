/**
 * DM-32UV hard interlocks. Code only: no setting, flag, env value or patch field can switch one off.
 * See DESIGN.md — Firmware flashing.
 */
import {
  DM32UV_FIRMWARE_IMAGE_SIZE,
  DM32UV_FIRMWARE_ROLE_BIN,
} from '@core/radios/baofeng/dm-32uv/firmware.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { RadioInterlockError } from '../../../kit/errors.ts';
import { DM32_FW_MODEL_ID_BYTES, type Dm32PlanStep } from './plan.ts';

/** The radio this updater serves. */
export const DM32_FW_RADIO_ID = 'baofeng-dm32uv' as const;

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export { bytesEqual as dm32BytesEqual };

/** Returns the `bin` bytes, or throws RadioInterlockError. */
export function checkDm32FirmwareImage(image: PreparedFirmwareImage): Uint8Array {
  if (image.radioId !== DM32_FW_RADIO_ID) {
    throw new RadioInterlockError('This firmware image is not for the DM-32UV.');
  }
  const roles = Object.keys(image.package.files);
  if (roles.length !== 1 || roles[0] !== DM32UV_FIRMWARE_ROLE_BIN) {
    throw new RadioInterlockError('A DM-32UV firmware image must be exactly one file.');
  }
  const bin = image.package.files[DM32UV_FIRMWARE_ROLE_BIN];
  if (!bin || bin.length !== DM32UV_FIRMWARE_IMAGE_SIZE) {
    throw new RadioInterlockError(
      `A DM-32UV firmware image must be ${DM32UV_FIRMWARE_IMAGE_SIZE} bytes long.`,
    );
  }
  if (!bytesEqual(bin.subarray(0, DM32_FW_MODEL_ID_BYTES.length), DM32_FW_MODEL_ID_BYTES)) {
    throw new RadioInterlockError('This firmware image does not carry the DM-32UV model ID.');
  }
  // The vendor CPS's own header check: any one of E, N, D at 0xFD..0xFF.
  if (!(bin[0xfd] === 0x45 || bin[0xfe] === 0x4e || bin[0xff] === 0x44)) {
    throw new RadioInterlockError('This firmware image has no valid DM-32UV header.');
  }
  return bin;
}

export interface Dm32TxGuard {
  /** Accepts exactly the next precomputed frame and nothing else. */
  check(frame: Uint8Array): void;
  advance(): void;
  readonly index: number;
}

/**
 * Port of `TxGuard`: the plan is the whole allow-list. The frames are copied when the guard is created, so a frame
 * changed afterwards is refused.
 */
export function createDm32TxGuard(plan: readonly Dm32PlanStep[], startIndex = 0): Dm32TxGuard {
  const allowed = plan.map((s) => s.tx.slice());
  let index = startIndex;
  return {
    check(frame) {
      const expected = allowed[index];
      if (!expected || !bytesEqual(frame, expected)) {
        throw new RadioInterlockError(
          `Refused to send an unexpected frame (${frame.length} bytes) at plan step ${index}.`,
        );
      }
    },
    advance() {
      index += 1;
    },
    get index() {
      return index;
    },
  };
}

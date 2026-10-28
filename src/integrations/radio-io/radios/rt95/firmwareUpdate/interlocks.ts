/**
 * RT95 front panel hard interlocks. Code only: no setting, flag, env value or patch field can switch one off.
 * Ports of `addr_problem`, `check_outgoing` and `Package.accept` in the firmware project's `tools/rt95update.py`.
 * See DESIGN.md — Firmware flashing and docs/reference/radios/retevis/rt95/firmware.md.
 *
 *  1. Target binding: radio id `retevis-rt95-head`, roles exactly cdd, cdi, spi.
 *  2. Package shape (`parseRt95HeadPackage`).
 *  3. Address window on every block: nothing below 0x08002000 (the bootloader), nothing at or above 0x08020000.
 *  4. Vector table: head SP range (refuses the main-board image), odd reset vector inside the image.
 *  5. Model string `RT95-P\0` at `.CDD` offset 0x15360.
 *  6. Outgoing gate on every write.
 */
import { RT95_HEAD_FIRMWARE_ROLE } from '@core/radios/retevis/rt95/firmware.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { RadioInterlockError } from '../../../kit/errors.ts';
import {
  RT95_HEAD_FW_ACK,
  RT95_HEAD_FW_BASE,
  RT95_HEAD_FW_BLOCK,
  RT95_HEAD_FW_CLONE_END,
  RT95_HEAD_FW_END,
  RT95_HEAD_FW_FRAME,
  RT95_HEAD_FW_FRAME_START,
  RT95_HEAD_FW_LIMIT,
  RT95_HEAD_FW_MODEL,
  RT95_HEAD_FW_MODEL_OFFSET,
  RT95_HEAD_FW_PROGRAM,
  RT95_HEAD_FW_RADIO_ID,
  RT95_HEAD_FW_SP_MAX,
  RT95_HEAD_FW_SP_MIN,
} from './constants.ts';
import { rt95FrameAddr, rt95FrameStoredSum, rt95FrameSum } from './frames.ts';
import { parseRt95HeadPackage, rt95HeadBlocks, type Rt95HeadPackage } from './package.ts';

export { RT95_HEAD_FW_RADIO_ID };

const hex32 = (a: number) => `0x${a.toString(16).padStart(8, '0')}`;

/** Why a 1,024-byte block at `addr` must not be sent, or undefined. */
export function rt95AddrProblem(addr: number): string | undefined {
  if (addr < RT95_HEAD_FW_BASE || addr + RT95_HEAD_FW_BLOCK > RT95_HEAD_FW_LIMIT) {
    return `${hex32(addr)} is outside the firmware window ${hex32(RT95_HEAD_FW_BASE)}-${hex32(RT95_HEAD_FW_LIMIT)}.`;
  }
  return undefined;
}

const u32 = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

/** Whole-package checks before any byte is sent (interlocks 3 to 5). Throws RadioInterlockError. */
export function checkRt95HeadPackage(pkg: Rt95HeadPackage): void {
  for (const { addr } of rt95HeadBlocks(pkg)) {
    const why = rt95AddrProblem(addr);
    if (why) throw new RadioInterlockError(why);
  }
  const { image, entry } = pkg;
  if (entry.len < 8) {
    throw new RadioInterlockError('The firmware image is too short to hold a vector table.');
  }
  const sp = u32(image, 0);
  const reset = u32(image, 4);
  if (sp <= RT95_HEAD_FW_SP_MIN) {
    throw new RadioInterlockError(
      'This is a main-board image. Studio only flashes the RT95 front panel.',
    );
  }
  if (
    sp > RT95_HEAD_FW_SP_MAX ||
    reset < RT95_HEAD_FW_BASE ||
    reset >= RT95_HEAD_FW_BASE + entry.len ||
    (reset & 1) === 0
  ) {
    throw new RadioInterlockError(
      `The firmware vector table does not look like the RT95 front panel (SP ${hex32(sp)}, reset ${hex32(reset)}).`,
    );
  }
  const modelEnd = RT95_HEAD_FW_MODEL_OFFSET + RT95_HEAD_FW_MODEL.length;
  const model = image.subarray(RT95_HEAD_FW_MODEL_OFFSET, modelEnd);
  if (
    entry.len < modelEnd ||
    model.length !== RT95_HEAD_FW_MODEL.length ||
    model.some((b, i) => b !== RT95_HEAD_FW_MODEL[i])
  ) {
    throw new RadioInterlockError(
      'The firmware image does not carry the RT95-P model string where the front panel expects it.',
    );
  }
}

/** Returns the parsed package, or throws RadioInterlockError (interlocks 1 to 5). */
export function checkRt95HeadFirmwareImage(image: PreparedFirmwareImage): Rt95HeadPackage {
  if (image.radioId !== RT95_HEAD_FW_RADIO_ID) {
    throw new RadioInterlockError('This firmware image is not for the RT95 front panel.');
  }
  const files = image.package.files;
  const roles = Object.keys(files).sort();
  const want = [
    RT95_HEAD_FIRMWARE_ROLE.CDD,
    RT95_HEAD_FIRMWARE_ROLE.CDI,
    RT95_HEAD_FIRMWARE_ROLE.SPI,
  ];
  if (roles.length !== want.length || roles.some((r, i) => r !== want[i])) {
    throw new RadioInterlockError(
      'An RT95 front panel firmware image must be exactly the .CDD, .CDI and .spi files.',
    );
  }
  const pkg = parseRt95HeadPackage({
    cdd: files[RT95_HEAD_FIRMWARE_ROLE.CDD]!,
    cdi: files[RT95_HEAD_FIRMWARE_ROLE.CDI]!,
    spi: files[RT95_HEAD_FIRMWARE_ROLE.SPI]!,
  });
  checkRt95HeadPackage(pkg);
  return pkg;
}

/** State the outgoing gate needs: set by the updater, never by a caller-supplied option. */
export interface Rt95OutgoingState {
  /** True only on the normal-mode exit path: the radio answered `PROGRAM` with `QX 06`. */
  cloneEndAllowed: boolean;
}

function equals(frame: Uint8Array, want: Uint8Array): boolean {
  return frame.length === want.length && want.every((b, i) => frame[i] === b);
}

/**
 * The single gate for everything sent in update mode: `PROGRAM`, the end byte `18`, `END` only on the normal-mode
 * exit path, and well-formed data frames to safe addresses. Everything else is refused (`02`, codeplug `R`/`W`
 * frames, an empty frame).
 */
export function checkRt95HeadOutgoing(frame: Uint8Array, state: Rt95OutgoingState): void {
  if (equals(frame, RT95_HEAD_FW_PROGRAM)) return;
  if (frame.length === 1 && frame[0] === RT95_HEAD_FW_END) return;
  if (equals(frame, RT95_HEAD_FW_CLONE_END)) {
    if (state.cloneEndAllowed) return;
    throw new RadioInterlockError('Refused to send END outside the normal-mode exit path.');
  }
  if (
    frame.length === RT95_HEAD_FW_FRAME &&
    frame[0] === RT95_HEAD_FW_FRAME_START &&
    frame[RT95_HEAD_FW_FRAME - 1] === RT95_HEAD_FW_ACK
  ) {
    if (rt95FrameStoredSum(frame) !== rt95FrameSum(frame)) {
      throw new RadioInterlockError('Refused a data frame with a wrong checksum.');
    }
    const why = rt95AddrProblem(rt95FrameAddr(frame));
    if (why) throw new RadioInterlockError(`Refused a data frame: ${why}`);
    return;
  }
  const head = Array.from(frame.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join(' ');
  throw new RadioInterlockError(
    `Refused to send ${head || 'an empty frame'}${frame.length > 8 ? '…' : ''} to the RT95 bootloader.`,
  );
}

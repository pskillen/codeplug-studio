/**
 * RT95 firmware hard interlocks, shared by every target through a profile (targets.ts); the head is bound below. Code only: no setting, flag, env value or patch field can switch one off.
 * Ports of `addr_problem`, `check_outgoing` and `Package.accept` in the firmware project's `tools/rt95update.py`.
 * See DESIGN.md — Firmware flashing and docs/reference/radios/retevis/rt95/firmware.md.
 *
 *  1. Target binding: radio id `retevis-rt95-head`, roles exactly cdd, cdi, spi.
 *  2. Package shape (`parseRt95HeadPackage`).
 *  3. Address window on every block: nothing below 0x08002000 (the bootloader), nothing at or above the target's
 *     limit (head: 0x08020000); optional frame cap.
 *  4. Vector table: the target's SP rule (head: range, refuses the main-board image), odd reset inside the image.
 *  5. Model string `RT95-P\0` at the target's `.CDD` offset (head: 0x15360).
 *  6. Target image rule (`checkImageIdentity`; MAIN: the pinned stock only, no flag turns it off).
 *  7. Outgoing gate on every write.
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
  RT95_HEAD_FW_MODEL,
  RT95_HEAD_FW_PROGRAM,
  RT95_HEAD_FW_RADIO_ID,
} from './constants.ts';
import { rt95FrameAddr, rt95FrameStoredSum, rt95FrameSum } from './frames.ts';
import { RT95_HEAD_TARGET, type Rt95FirmwareTarget } from './targets.ts';
import { parseRt95HeadPackage, rt95HeadBlocks, type Rt95HeadPackage } from './package.ts';

export { RT95_HEAD_FW_RADIO_ID };

const hex32 = (a: number) => `0x${a.toString(16).padStart(8, '0')}`;

/** Why a 1,024-byte block at `addr` must not be sent to `target`, or undefined. */
export function rt95AddrProblem(
  addr: number,
  target: Rt95FirmwareTarget = RT95_HEAD_TARGET,
): string | undefined {
  if (addr < RT95_HEAD_FW_BASE || addr + RT95_HEAD_FW_BLOCK > target.limit) {
    return `${hex32(addr)} is outside the firmware window ${hex32(RT95_HEAD_FW_BASE)}-${hex32(target.limit)}.`;
  }
  return undefined;
}

const u32 = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

/** Whole-package checks before any byte is sent (interlocks 3 to 5). Throws RadioInterlockError. */
export function checkRt95Package(pkg: Rt95HeadPackage, target: Rt95FirmwareTarget): void {
  let frames = 0;
  for (const { addr } of rt95HeadBlocks(pkg)) {
    const why = rt95AddrProblem(addr, target);
    if (why) throw new RadioInterlockError(why);
    frames += 1;
  }
  if (target.maxFrames !== undefined && frames > target.maxFrames) {
    throw new RadioInterlockError(
      target.copy.tooManyFrames?.(frames, target.maxFrames) ??
        `The firmware image has ${frames} data frames; the ${target.label} takes at most ${target.maxFrames}.`,
    );
  }
  const { image, entry } = pkg;
  if (entry.len < 8) {
    throw new RadioInterlockError('The firmware image is too short to hold a vector table.');
  }
  const sp = u32(image, 0);
  const reset = u32(image, 4);
  const rule = target.sp;
  if (rule.kind === 'range' && sp <= rule.minExclusive) {
    throw new RadioInterlockError(target.copy.otherTargetImage);
  }
  if (rule.kind === 'exact' && rule.otherTargetRange) {
    const o = rule.otherTargetRange;
    if (sp > o.minExclusive && sp <= o.maxInclusive) {
      throw new RadioInterlockError(target.copy.otherTargetImage);
    }
  }
  const spBad = rule.kind === 'range' ? sp > rule.maxInclusive : sp !== rule.value;
  if (
    spBad ||
    reset < RT95_HEAD_FW_BASE ||
    reset >= RT95_HEAD_FW_BASE + entry.len ||
    (reset & 1) === 0
  ) {
    throw new RadioInterlockError(target.copy.vectorTable(hex32(sp), hex32(reset)));
  }
  const modelEnd = target.modelOffset + RT95_HEAD_FW_MODEL.length;
  const model = image.subarray(target.modelOffset, modelEnd);
  if (
    entry.len < modelEnd ||
    model.length !== RT95_HEAD_FW_MODEL.length ||
    model.some((b, i) => b !== RT95_HEAD_FW_MODEL[i])
  ) {
    throw new RadioInterlockError(target.copy.model);
  }
}

/** Returns the parsed package, or throws RadioInterlockError (interlocks 1 to 5). */
export function checkRt95FirmwareImage(
  image: PreparedFirmwareImage,
  target: Rt95FirmwareTarget,
): Rt95HeadPackage {
  if (image.radioId !== target.radioId) {
    throw new RadioInterlockError(target.copy.notThisTarget);
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
      `An ${target.label} firmware image must be exactly the .CDD, .CDI and .spi files.`,
    );
  }
  const pkg = parseRt95HeadPackage({
    cdd: files[RT95_HEAD_FIRMWARE_ROLE.CDD]!,
    cdi: files[RT95_HEAD_FIRMWARE_ROLE.CDI]!,
    spi: files[RT95_HEAD_FIRMWARE_ROLE.SPI]!,
  });
  checkRt95Package(pkg, target);
  target.checkImageIdentity?.(image);
  return pkg;
}

/** Head-bound wrappers: the head's callers and tests keep their names. */
export const checkRt95HeadPackage = (pkg: Rt95HeadPackage): void =>
  checkRt95Package(pkg, RT95_HEAD_TARGET);
export const checkRt95HeadFirmwareImage = (image: PreparedFirmwareImage): Rt95HeadPackage =>
  checkRt95FirmwareImage(image, RT95_HEAD_TARGET);

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
export function checkRt95Outgoing(
  frame: Uint8Array,
  state: Rt95OutgoingState,
  target: Rt95FirmwareTarget,
): void {
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
    const why = rt95AddrProblem(rt95FrameAddr(frame), target);
    if (why) throw new RadioInterlockError(`Refused a data frame: ${why}`);
    return;
  }
  const head = Array.from(frame.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join(' ');
  throw new RadioInterlockError(
    `Refused to send ${head || 'an empty frame'}${frame.length > 8 ? '…' : ''} to the RT95 bootloader.`,
  );
}

export const checkRt95HeadOutgoing = (frame: Uint8Array, state: Rt95OutgoingState): void =>
  checkRt95Outgoing(frame, state, RT95_HEAD_TARGET);

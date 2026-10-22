/**
 * AT-D890UV hard interlocks. Code only: no setting, flag, env value or patch field can switch one off.
 * Ports of `addr_problem`, `check_outgoing` and `check_package` in the firmware project's `tools/d890update.py`,
 * firmware mode only. See DESIGN.md — Firmware flashing.
 */
import { AT_D890UV_FIRMWARE_ROLE } from '@core/radios/anytone/at-d890uv/firmware.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';

import { RadioInterlockError } from '../../../kit/errors.ts';
import {
  AT_D890_FW_ACK,
  AT_D890_FW_ACTIVATION_END,
  AT_D890_FW_ACTIVATION_START,
  AT_D890_FW_BASE,
  AT_D890_FW_BLOCK,
  AT_D890_FW_END,
  AT_D890_FW_FRAME,
  AT_D890_FW_FRAME_START,
  AT_D890_FW_IDENT_REQ,
  AT_D890_FW_LIMIT,
  AT_D890_FW_SRAM_END,
  AT_D890_FW_SRAM_START,
  AT_D890_FW_UPDATE,
} from './constants.ts';
import { d890FrameAddr, d890FrameSum } from './frames.ts';
import { d890Blocks, type D890FirmwarePackage, parseD890FirmwarePackage } from './package.ts';

/** The radio this updater serves. */
export const AT_D890_FW_RADIO_ID = 'anytone-at-d890uv' as const;

const hex32 = (a: number) => `0x${a.toString(16).padStart(8, '0')}`;

/** Why a 32-byte block at `addr` must not be sent, or undefined. */
export function d890AddrProblem(addr: number): string | undefined {
  const end = addr + AT_D890_FW_BLOCK;
  if (addr < AT_D890_FW_BASE || end > AT_D890_FW_LIMIT) {
    return `${hex32(addr)} is outside the firmware window ${hex32(AT_D890_FW_BASE)}-${hex32(AT_D890_FW_LIMIT)}.`;
  }
  if (addr < AT_D890_FW_ACTIVATION_END && end > AT_D890_FW_ACTIVATION_START) {
    return `${hex32(addr)} touches the activation page.`;
  }
  return undefined;
}

const u32 = (b: Uint8Array, o: number) =>
  (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

/** Whole-package checks before any byte is sent. Throws RadioInterlockError. */
export function checkD890Package(pkg: D890FirmwarePackage): void {
  for (const { addr } of d890Blocks(pkg)) {
    const why = d890AddrProblem(addr);
    if (why) throw new RadioInterlockError(why);
  }
  const first = pkg.entries[0];
  if (!first || first.addr !== AT_D890_FW_BASE) {
    throw new RadioInterlockError(`The first entry must load at ${hex32(AT_D890_FW_BASE)}.`);
  }
  if (pkg.cdd.length < 8) {
    throw new RadioInterlockError('The firmware image is too short to hold a vector table.');
  }
  const sp = u32(pkg.cdd, 0);
  const reset = u32(pkg.cdd, 4);
  const end = AT_D890_FW_BASE + first.len;
  if (
    sp < AT_D890_FW_SRAM_START ||
    sp > AT_D890_FW_SRAM_END ||
    reset < AT_D890_FW_BASE ||
    reset >= end ||
    (reset & 1) === 0
  ) {
    throw new RadioInterlockError(
      `The firmware vector table does not look right (SP ${hex32(sp)}, reset ${hex32(reset)}).`,
    );
  }
}

/** Returns the parsed package, or throws RadioInterlockError. */
export function checkD890FirmwareImage(image: PreparedFirmwareImage): D890FirmwarePackage {
  if (image.radioId !== AT_D890_FW_RADIO_ID) {
    throw new RadioInterlockError('This firmware image is not for the AT-D890UV.');
  }
  const files = image.package.files;
  const roles = Object.keys(files).sort();
  const want = [
    AT_D890UV_FIRMWARE_ROLE.CDD,
    AT_D890UV_FIRMWARE_ROLE.CDI,
    AT_D890UV_FIRMWARE_ROLE.SPI,
  ];
  if (roles.length !== want.length || roles.some((r, i) => r !== want[i])) {
    throw new RadioInterlockError(
      'An AT-D890UV firmware image must be exactly the .CDD, .CDI and .spi files.',
    );
  }
  const pkg = parseD890FirmwarePackage({
    cdd: files[AT_D890UV_FIRMWARE_ROLE.CDD]!,
    cdi: files[AT_D890UV_FIRMWARE_ROLE.CDI]!,
    spi: files[AT_D890UV_FIRMWARE_ROLE.SPI]!,
  });
  checkD890Package(pkg);
  return pkg;
}

function isSingle(frame: Uint8Array, byte: number): boolean {
  return frame.length === 1 && frame[0] === byte;
}

function isUpdate(frame: Uint8Array): boolean {
  if (frame.length !== AT_D890_FW_UPDATE.length) return false;
  for (let i = 0; i < frame.length; i++) if (frame[i] !== AT_D890_FW_UPDATE[i]) return false;
  return true;
}

/**
 * The single gate for everything sent in firmware mode: `UPDATE`, the ident request `02`, the end byte `18`, and
 * well-formed data frames to safe addresses. Everything else is refused.
 */
export function checkD890Outgoing(frame: Uint8Array): void {
  if (isUpdate(frame) || isSingle(frame, AT_D890_FW_IDENT_REQ) || isSingle(frame, AT_D890_FW_END)) {
    return;
  }
  if (
    frame.length === AT_D890_FW_FRAME &&
    frame[0] === AT_D890_FW_FRAME_START &&
    frame[AT_D890_FW_FRAME - 1] === AT_D890_FW_ACK
  ) {
    if ((frame[37]! | (frame[38]! << 8)) !== d890FrameSum(frame)) {
      throw new RadioInterlockError('Refused a data frame with a wrong checksum.');
    }
    const why = d890AddrProblem(d890FrameAddr(frame));
    if (why) throw new RadioInterlockError(`Refused a data frame: ${why}`);
    return;
  }
  const head = Array.from(frame.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join(' ');
  throw new RadioInterlockError(
    `Refused to send ${head || 'an empty frame'}${frame.length > 8 ? '…' : ''} to the AT-D890UV bootloader.`,
  );
}

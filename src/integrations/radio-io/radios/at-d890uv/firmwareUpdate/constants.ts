/**
 * AT-D890UV update-mode bootloader: protocol-only facts (link, frame bytes, address windows, timeouts).
 * Spec: the firmware project's `tools/d890update.py` and `docs/reference/firmware/update-protocol-and-bootloader.md`.
 * Human mirror: docs/reference/radios/anytone/at-d890uv/firmware.md — "Bootloader update protocol".
 * Firmware mode only: resource mode (`PROGRAM`, the ICON pack) is deliberately not supported.
 */
import type { FirmwareLinkSpec } from '../../../firmware/types.ts';
import { AT_D890_CONNECTION } from '../constants.ts';

/**
 * ST's generic CDC ID, the same in app mode and update mode: the filter identifies the device, not the mode.
 * CDC ignores the baud rate.
 */
export const AT_D890_FW_LINK: FirmwareLinkSpec = {
  baudRate: AT_D890_CONNECTION.BAUD_RATE,
  usbFilters: [{ usbVendorId: 0x0483, usbProductId: 0x5740 }],
  raiseDtrRts: true,
};

/** Firmware image load address: the first `.CDI` entry must load here. */
export const AT_D890_FW_BASE = 0x0800c000;
/** The BK image cache starts here: never write at or above it. */
export const AT_D890_FW_LIMIT = 0x081e4000;
/** The page that holds the activation key, with the bootloader below. Never written. */
export const AT_D890_FW_ACTIVATION_START = 0x0800a000;
export const AT_D890_FW_ACTIVATION_END = 0x0800c000;

/** `.CDI` entry size. */
export const AT_D890_FW_ENTRY = 278;
/** Data bytes per frame. */
export const AT_D890_FW_BLOCK = 32;
/** `01` + addr u32 + 32 data + sum u16 + `06`. */
export const AT_D890_FW_FRAME = 40;

/** Initial stack pointer bounds for the vector-table sanity check (SRAM). */
export const AT_D890_FW_SRAM_START = 0x20000000;
export const AT_D890_FW_SRAM_END = 0x20040000;

/** Reply timeouts in milliseconds. */
export const AT_D890_FW_TIMEOUT_MS = {
  HANDSHAKE: 2000,
  /** The reply to the first data frame may follow a flash erase. */
  FIRST_FRAME: 30_000,
  FRAME: 2000,
  END: 2000,
} as const;

export const AT_D890_FW_UPDATE = Uint8Array.from('UPDATE', (c) => c.charCodeAt(0));
export const AT_D890_FW_IDENT_REQ = 0x02;
export const AT_D890_FW_END = 0x18;
export const AT_D890_FW_ACK = 0x06;
export const AT_D890_FW_NAK = 0x15;
export const AT_D890_FW_FRAME_START = 0x01;
/** Bootloader ident reply length: `I` + model (7) + band + version (4) + `00 00` + `06`. */
export const AT_D890_FW_IDENT_LEN = 16;
/** The band byte at ident[8] is `00` in the bootloader; `03` means the radio is in normal (app) mode. */
export const AT_D890_FW_BOOTLOADER_BAND = 0x00;
/** The `UPDATE` reply is read byte by byte until `06`, at most this many bytes. */
export const AT_D890_FW_UPDATE_REPLY_MAX = 16;

/** Data frames for the pinned stock `.CDD` (1,675,272 B / 32). */
export const AT_D890_FW_FRAMES_STOCK = 52_353;
/** Data frames for release `1.0.0` (1,680,476 B, rounded up). */
export const AT_D890_FW_FRAMES_1_0_0 = 52_515;

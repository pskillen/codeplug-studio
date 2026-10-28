/**
 * RT95 front panel (head) bootloader update: protocol-only facts (link, frame bytes, address window, timeouts).
 * Spec: the firmware project's `tools/rt95update.py` and `docs/reference/update-protocol.md`.
 * Human mirror: docs/reference/radios/retevis/rt95/firmware.md — "Bootloader update protocol".
 * Head only: the main board (MAIN) is never offered.
 */
import type { FirmwareLinkSpec } from '../../../firmware/types.ts';

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));

export const RT95_HEAD_FW_RADIO_ID = 'retevis-rt95-head' as const;

export const RT95_HEAD_FW_LINK: FirmwareLinkSpec = {
  baudRate: 115_200,
  // Programming-cable USB-serial chips. Identifies the cable, not the mode.
  usbFilters: [
    { usbVendorId: 0x067b, usbProductId: 0x2303 }, // Prolific PL2303
    { usbVendorId: 0x1a86, usbProductId: 0x7523 }, // WCH CH340
    { usbVendorId: 0x0403, usbProductId: 0x6001 }, // FTDI FT232R
  ],
  raiseDtrRts: true, // same as the codeplug path (webSerialPipe asserts DTR/RTS on open)
};

/** App load address; the bootloader is below it and is never written. */
export const RT95_HEAD_FW_BASE = 0x08002000;
/** Never write at or above this address (the end of the 128 KB part). */
export const RT95_HEAD_FW_LIMIT = 0x08020000;
/** `.CDI` entry size. */
export const RT95_HEAD_FW_ENTRY = 278;
/** `.spi` size: `{u16 count, u32 total, u32 0}`. */
export const RT95_HEAD_FW_SPI_LEN = 10;
/** Data bytes per frame (and the alignment of every entry). */
export const RT95_HEAD_FW_BLOCK = 1024;
/** `01` + addr u32 + 1,024 data + sum u16 + `06`. */
export const RT95_HEAD_FW_FRAME = 1032;
/** Initial SP must be > MIN and <= MAX: the head's 20 KB SRAM, above the main board's whole 8 KB. */
export const RT95_HEAD_FW_SP_MIN = 0x20002000;
export const RT95_HEAD_FW_SP_MAX = 0x20005000;
/** `.CDD` file offset of the model string (0x08017360), the target of the head's own `0xA5` model check. */
export const RT95_HEAD_FW_MODEL_OFFSET = 0x15360;
export const RT95_HEAD_FW_MODEL = ascii('RT95-P\0');

export const RT95_HEAD_FW_TIMEOUT_MS = {
  HANDSHAKE: 2000,
  FIRST_FRAME: 10_000,
  FRAME: 3000,
  END: 2000,
} as const;
export const RT95_HEAD_FW_HANDSHAKE_TRIES = 3;
/** The vendor resends forever on a NAK; Studio caps it. */
export const RT95_HEAD_FW_RESENDS = 3;

export const RT95_HEAD_FW_PROGRAM = ascii('PROGRAM');
/** Normal-mode clone exit; also puts the main board back. Sent only on the normal-mode exit path. */
export const RT95_HEAD_FW_CLONE_END = ascii('END');
export const RT95_HEAD_FW_IDENT_REQ = 0x02;

export const RT95_HEAD_FW_ACK = 0x06;
export const RT95_HEAD_FW_NAK = 0x15;
export const RT95_HEAD_FW_END = 0x18;
export const RT95_HEAD_FW_FRAME_START = 0x01;

/** The stock head V1.41 image is this many frames (0x08002000 to 0x0801C000). */
export const RT95_HEAD_FW_FRAMES_STOCK = 104;

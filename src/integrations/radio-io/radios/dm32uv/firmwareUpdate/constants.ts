/**
 * DM-32UV update-mode bootloader: protocol-only facts (link, frame bytes, timeouts, block sizes).
 * Spec: the firmware project's `tools/flash/dm32_fw_send.py` and `docs/reference/update-protocol.md`.
 * Human mirror: docs/reference/radios/baofeng/dm-32uv/firmware.md — "Bootloader update protocol".
 */
import type { FirmwareLinkSpec } from '../../../firmware/types.ts';

/** CH340 cable, 115200 8N1 with DTR/RTS raised. The cable enumerates with or without a radio attached. */
export const DM32_FW_LINK: FirmwareLinkSpec = {
  baudRate: 115_200,
  usbFilters: [{ usbVendorId: 0x1a86, usbProductId: 0x7523 }],
  raiseDtrRts: true,
};

/** Reply timeouts in milliseconds. */
export const DM32_FW_TIMEOUT_MS = {
  HANDSHAKE: 500,
  PRELUDE_31: 5000,
  SOH: 5000,
  /** The CPS waits 20 s; the erase was observed at 12.6 s. */
  ERASE: 60_000,
  DATA: 10_000,
  EOT: 5000,
} as const;

/** The CPS's ComWrite purges RX and waits 10 ms before every write. */
export const DM32_FW_PRE_SEND_DELAY_MS = 10;

export const DM32_FW_SOH = 0x01;
export const DM32_FW_STX = 0x02;
export const DM32_FW_EOT = 0x04;
export const DM32_FW_ACK = 0x06;
/** ASCII 'C': the receiver asks for CRC mode / the next frame. */
export const DM32_FW_CRC_CHAR = 0x43;

export const DM32_FW_INIT = Uint8Array.of(0x52);
export const DM32_FW_MODEL_QUERY = Uint8Array.of(0x4d, 0x00, 0x00, 0x00, 0x01);
/** Reply to the model query: `4D 01 <model id length>`. */
export const DM32_FW_MODEL_QUERY_REPLY = Uint8Array.of(0x4d, 0x01, 0x09);
export const DM32_FW_PRELUDE_45 = Uint8Array.of(0x45, 0x00, 0x00, 0x00, 0x00);
export const DM32_FW_PRELUDE_31 = Uint8Array.of(0x31);

export const DM32_FW_BLOCK_BIG = 0x400;
export const DM32_FW_BLOCK_SMALL = 0x80;
export const DM32_FW_BLOCK0_LEN = 0x80;
export const DM32_FW_PAD = 0x1a;

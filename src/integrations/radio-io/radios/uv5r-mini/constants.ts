/**
 * UV-5R Mini PROGRAM+R/W layout constants.
 * Cite: NeonPlug src/radios/uv5rmini/constants.ts; CHIRP UV5RMini (facts only).
 * Tier-3: docs/reference/radios/baofeng/uv-5r-mini/
 */

import { UV5R_MINI_LAYOUT } from '../uv17pro-family/layout.ts';

const L = UV5R_MINI_LAYOUT;

/** 16-byte ident magic (MSTRING_UV17PROGPS). */
export const UV5R_MINI_IDENT = L.ident;

/** Expected ACK after ident / write. */
export const UV5R_MINI_ACK = 0x06;

/** Block size for R/W frames. */
export const UV5R_MINI_BLOCK_SIZE = L.blockSize;

/** Read response = 4-byte header + BLOCK_SIZE payload. */
export const UV5R_MINI_READ_RESPONSE_LEN = 4 + L.blockSize;

/** Radio memory regions: [start addr, size]. Full clone. */
export const UV5R_MINI_MEM_STARTS = L.memStarts;
export const UV5R_MINI_MEM_SIZES = L.memSizes;
export const UV5R_MINI_MEM_TOTAL = L.memTotal;

/** Number of 64-byte blocks for full clone. */
export const UV5R_MINI_CLONE_BLOCK_COUNT = L.cloneBlockCount;

export const UV5R_MINI_CHANNEL_COUNT = L.channelCount;
export const UV5R_MINI_CHANNEL_SIZE = L.channelSize;
/** Packed span of all channel records. */
export const UV5R_MINI_CHANNEL_SPAN = L.channelSpan;

/** Primary baud — CHIRP UV17Pro / UV5RMini (115200). */
export const UV5R_MINI_BAUD_RATE = L.baudRate;

/** Fallback when ident fails at primary — NeonPlug browser lineage (38400). */
export const UV5R_MINI_BAUD_RATE_FALLBACK = L.baudRateFallback!;

/** Post-open settle before ident (NeonPlug serialConnection). */
export const UV5R_MINI_INIT_DELAY_MS = L.initDelayMs;

/** Buffer clear settle before ident (NeonPlug serialConnection). */
export const UV5R_MINI_CLEAR_BUFFER_DELAY_MS = L.clearBufferDelayMs;

/** Firmware version string offset in packed clone image. */
export const UV5R_MINI_FW_VER_OFFSET = L.fwVerOffset;

/** Packed-image retain region offsets — cite tier-3 settings.md / memory-layout.md. */
export const UV5R_MINI_VFO_A_OFFSET = L.vfoAOffset;
export const UV5R_MINI_VFO_B_OFFSET = L.vfoBOffset;
export const UV5R_MINI_VFO_SIZE = L.vfoSize;
export const UV5R_MINI_SETTINGS_OFFSET = L.settingsOffset;
export const UV5R_MINI_SETTINGS_SIZE = L.settingsSize;
export const UV5R_MINI_ANI_OFFSET = L.aniOffset;
export const UV5R_MINI_ANI_SIZE = L.aniSize;
export const UV5R_MINI_PTT_ID_OFFSET = L.pttIdOffset;
export const UV5R_MINI_PTT_ID_SIZE = L.pttIdSize;
export const UV5R_MINI_UPCODE_OFFSET = L.upcodeOffset;
export const UV5R_MINI_UPCODE_SIZE = L.upcodeSize;
export const UV5R_MINI_DOWNCODE_OFFSET = L.downcodeOffset;
export const UV5R_MINI_DOWNCODE_SIZE = L.downcodeSize;

/** Default XOR symbol index ("CO 7"). */
export const UV5R_MINI_DEFAULT_ENCRSYM = L.defaultEncrsym;

/** Timeout for ident ACK. */
export const UV5R_MINI_IDENT_TIMEOUT_MS = L.identTimeoutMs;
/** Timeout for magic replies / block reads. */
export const UV5R_MINI_IO_TIMEOUT_MS = L.ioTimeoutMs;
/** Timeout for write ACK. */
export const UV5R_MINI_WRITE_ACK_TIMEOUT_MS = L.writeAckTimeoutMs;

export { UV5R_MINI_LAYOUT };

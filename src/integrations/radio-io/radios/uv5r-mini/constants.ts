/**
 * UV-5R Mini PROGRAM+R/W layout constants.
 * Cite: NeonPlug src/radios/uv5rmini/constants.ts; CHIRP UV5RMini (facts only).
 * Tier-3: docs/reference/radios/baofeng/uv-5r-mini/
 */

/** 16-byte ident magic (MSTRING_UV17PROGPS). */
export const UV5R_MINI_IDENT = new TextEncoder().encode('PROGRAMCOLORPROU');

/** Expected ACK after ident / write. */
export const UV5R_MINI_ACK = 0x06;

/** Block size for R/W frames. */
export const UV5R_MINI_BLOCK_SIZE = 0x40;

/** Read response = 4-byte header + BLOCK_SIZE payload. */
export const UV5R_MINI_READ_RESPONSE_LEN = 4 + UV5R_MINI_BLOCK_SIZE;

/** Radio memory regions: [start addr, size]. Full clone. */
export const UV5R_MINI_MEM_STARTS = [0x0000, 0x9000, 0xa000] as const;
export const UV5R_MINI_MEM_SIZES = [0x8040, 0x0040, 0x01c0] as const;
export const UV5R_MINI_MEM_TOTAL = 0x8240;

/** Number of 64-byte blocks for full clone. */
export const UV5R_MINI_CLONE_BLOCK_COUNT = UV5R_MINI_MEM_SIZES.reduce(
  (sum, n) => sum + n / UV5R_MINI_BLOCK_SIZE,
  0,
);

export const UV5R_MINI_CHANNEL_COUNT = 999;
export const UV5R_MINI_CHANNEL_SIZE = 32;
/** Packed span of all channel records. */
export const UV5R_MINI_CHANNEL_SPAN = UV5R_MINI_CHANNEL_COUNT * UV5R_MINI_CHANNEL_SIZE; // 0x7CE0

/** Primary baud — CHIRP UV17Pro / UV5RMini (115200). */
export const UV5R_MINI_BAUD_RATE = 115_200;

/** Fallback when ident fails at primary — NeonPlug browser lineage (38400). */
export const UV5R_MINI_BAUD_RATE_FALLBACK = 38_400;

/** Post-open settle before ident (NeonPlug serialConnection). */
export const UV5R_MINI_INIT_DELAY_MS = 300;

/** Buffer clear settle before ident (NeonPlug serialConnection). */
export const UV5R_MINI_CLEAR_BUFFER_DELAY_MS = 200;

/** Firmware version string offset in packed clone image. */
export const UV5R_MINI_FW_VER_OFFSET = 0x1ef0;

/** Default XOR symbol index ("CO 7"). */
export const UV5R_MINI_DEFAULT_ENCRSYM = 1;

/** Timeout for ident ACK. */
export const UV5R_MINI_IDENT_TIMEOUT_MS = 8000;
/** Timeout for magic replies / block reads. */
export const UV5R_MINI_IO_TIMEOUT_MS = 6000;
/** Timeout for write ACK. */
export const UV5R_MINI_WRITE_ACK_TIMEOUT_MS = 400;

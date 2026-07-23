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

/** Packed-image retain region offsets — cite tier-3 settings.md / memory-layout.md. */
export const UV5R_MINI_VFO_A_OFFSET = 0x8000;
export const UV5R_MINI_VFO_B_OFFSET = 0x8020;
export const UV5R_MINI_VFO_SIZE = 32;
export const UV5R_MINI_SETTINGS_OFFSET = 0x8040;
export const UV5R_MINI_SETTINGS_SIZE = 64;
export const UV5R_MINI_ANI_OFFSET = 0x8080;
export const UV5R_MINI_ANI_SIZE = 0x20;
export const UV5R_MINI_PTT_ID_OFFSET = 0x80a0;
export const UV5R_MINI_PTT_ID_SIZE = 0x140;
export const UV5R_MINI_UPCODE_OFFSET = 0x81e0;
export const UV5R_MINI_UPCODE_SIZE = 0x30;
export const UV5R_MINI_DOWNCODE_OFFSET = 0x8210;
export const UV5R_MINI_DOWNCODE_SIZE = UV5R_MINI_MEM_TOTAL - UV5R_MINI_DOWNCODE_OFFSET;

/** Default XOR symbol index ("CO 7"). */
export const UV5R_MINI_DEFAULT_ENCRSYM = 1;

/** Timeout for ident ACK. */
export const UV5R_MINI_IDENT_TIMEOUT_MS = 8000;
/** Timeout for magic replies / block reads. */
export const UV5R_MINI_IO_TIMEOUT_MS = 6000;
/** Timeout for write ACK. */
export const UV5R_MINI_WRITE_ACK_TIMEOUT_MS = 400;

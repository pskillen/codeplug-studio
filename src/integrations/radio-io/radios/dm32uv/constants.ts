/**
 * DM-32UV / DP570UV protocol constants.
 * Cite: NeonPlug src/radios/dm32uv/constants.ts (facts only).
 */

import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';

/** Metadata byte at offset 0xFFF of each 4KB block. */
export const DM32_METADATA = {
  CHANNEL_FIRST: 0x12,
  CHANNEL_LAST: 0x41,
  /** First zone page. The block header (count and VFO indices) lives only here. */
  ZONE: 0x5c,
  /**
   * Inclusive zone-page bank, nine tags (`0x5C`–`0x64`). Protocol layout only —
   * `ZONE_MAX` stays the core limits import. Do not treat this span as a second cap.
   */
  ZONE_PAGE_FIRST: 0x5c,
  ZONE_PAGE_LAST: 0x64,
  SCAN_LIST: 0x11,
  /** NeonPlug constants name — same value as ANALOG_EMERGENCY; discovery may map 0x03. */
  DIGITAL_EMERGENCY: 0x10,
  VFO_SETTINGS: 0x04,
  ANALOG_EMERGENCY: 0x10,
  QUICK_MESSAGES: 0x0a,
  METADATA_0x0B: 0x0b,
  RX_GROUPS: 0x0f,
  CALIBRATION: 0x02,
  TALK_GROUPS: 0x44,
  /** Analogue (DTMF) contact page. NeonPlug names this CONFIG_TG_COUNTER; that name is wrong. */
  ANALOG_CONTACTS: 0x06,
  TX_CONTACT_LOW: 0x42,
  TX_CONTACT_HIGH: 0x43,
  DMR_RADIO_IDS: 0x67,
  VFO_BANK: 0x41,
  EMPTY: 0x00,
  EMPTY_ALT: 0xff,
} as const;

export const DM32_BLOCK_SIZE = 4096;
export const DM32_CHANNEL_RECORD_SIZE = 48;
export const DM32_METADATA_OFFSET = 0xfff;

export const DM32_OFFSET = {
  CHANNEL_COUNT: 0x00,
  FIRST_CHANNEL: 0x10,
  /**
   * Count of 32-byte analogue (DTMF) contacts that start at +0x200.
   * It is not the talk-group count. Talk-group cardinality is tag 0x0B
   * bytes 0–1 and the tag 0x44 payload. Do not store a talk-group count here.
   * This disagrees with NeonPlug’s CONFIG_TG_COUNTER on purpose.
   */
  ANALOG_CONTACT_COUNT: 0x1ff,
} as const;

export const DM32_VFRAME = {
  FIRMWARE: 0x01,
  /** eFuse chip UID (first 8 bytes) plus 4 derived bytes. Not a radio serial. */
  EFUSE_IDENTITY: 0x02,
  BUILD_DATE: 0x03,
  DSP_VERSION: 0x04,
  RADIO_VERSION: 0x05,
  MEMORY_LAYOUT: 0x0a,
  CODEPLUG_VERSION: 0x0b,
  CONTACTS: 0x0f,
  /** Max contact count (u32 LE); NeonPlug also falls back to firmware L01 heuristics. */
  MAX_CONTACTS: 0x10,
} as const;

/** V-frame ids queried at connect (skip 0x0C — NeonPlug list). */
export const DM32_VFRAME_QUERY_IDS: readonly number[] = [
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0d, 0x0e, 0x0f, 0x10,
];

export const DM32_CONNECTION = {
  BAUD_RATE: 115200,
  INIT_DELAY_MS: 400,
  CLEAR_BUFFER_DELAY_MS: 200,
  PSEARCH_READ_DELAY_MS: 150,
  BLOCK_READ_DELAY_MS: 150,
  INTER_CMD_DELAY_MS: 50,
  METADATA_SCAN_DELAY_MS: 5,
  TIMEOUT: {
    HANDSHAKE_MS: 5000,
    VFRAME_MS: 5000,
    READ_MEMORY_MS: 15_000,
    WRITE_MEMORY_MS: 5000,
  },
} as const;

export const DM32_LIMITS = {
  CHANNEL_MAX: DM32UV_LIMITS.CHANNEL_MAX,
  CHANNELS_IN_FIRST_BLOCK: 84,
  CHANNELS_PER_LATER_BLOCK: 85,
  CHANNEL_SCAN_LIST_ID_MAX: DM32UV_LIMITS.CHANNEL_SCAN_LIST_ID_MAX,
  RX_GROUPS_MAX: DM32UV_LIMITS.RX_GROUPS_MAX,
  ZONE_MEMBERS_MAX: DM32UV_LIMITS.ZONE_MEMBERS_MAX,
  SCAN_LISTS_MAX: DM32UV_LIMITS.SCAN_LISTS_MAX,
  SCAN_LIST_MEMBERS_MAX: DM32UV_LIMITS.SCAN_LIST_MEMBERS_MAX,
  DMR_RADIO_IDS_MAX: DM32UV_LIMITS.RADIO_IDS_MAX,
  CONTACT_BANK_MAX_BLOCKS: DM32UV_LIMITS.CONTACT_BANK_MAX_BLOCKS,
  ADDRESS_BOOK_CONTACTS_PER_BLOCK: DM32UV_LIMITS.ADDRESS_BOOK_CONTACTS_PER_BLOCK,
  ADDRESS_BOOK_WRITE_MAX: DM32UV_LIMITS.ADDRESS_BOOK_WRITE_MAX,
  CONTACT_MAX_DEFAULT: DM32UV_LIMITS.FIRMWARE_CONTACT_MAX_DEFAULT,
  CONTACT_MAX_L01: DM32UV_LIMITS.FIRMWARE_CONTACT_MAX_L01,
} as const;

/** Max MemoryMap span when folding/allocating the address book into the config window. */
export const DM32_MAX_COMBINED_MAP_BYTES = 32 * 1024 * 1024;

/** Fixed metadata tags always bulk-read when present (NeonPlug bulkReadRequiredBlocks). */
export const DM32_REQUIRED_METADATA: readonly number[] = [
  DM32_METADATA.VFO_SETTINGS,
  DM32_METADATA.DIGITAL_EMERGENCY,
  DM32_METADATA.VFO_BANK,
  DM32_METADATA.QUICK_MESSAGES,
  DM32_METADATA.METADATA_0x0B,
  DM32_METADATA.DMR_RADIO_IDS,
  DM32_METADATA.CALIBRATION,
  DM32_METADATA.RX_GROUPS,
  DM32_METADATA.TALK_GROUPS,
  DM32_METADATA.ANALOG_CONTACTS,
  DM32_METADATA.TX_CONTACT_LOW,
  DM32_METADATA.TX_CONTACT_HIGH,
];

export const DM32_MODEL_IDS = ['DM-32UV', 'DP570UV'] as const;

/**
 * Program-flash factory sector `0x0300B000`–`0x0300BFFF`.
 * The only `0x47` frame Studio sends. Never send opcode `0x43` or `0x53`.
 */
export const DM32_FACTORY_SECTOR_ADDRESS = 0x0300_b000;
export const DM32_FACTORY_SECTOR_LENGTH = 4096;
export const DM32_FACTORY_SECTOR_READ_FRAME = new Uint8Array([0x47, 0x00, 0x00, 0x00, 0x00, 0x10]);
/** Reply opcode. Receiving this is required. Sending it erases the sector. */
export const DM32_FACTORY_SECTOR_REPLY_OPCODE = 0x53;

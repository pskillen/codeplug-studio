/**
 * DM-32UV / DP570UV protocol constants.
 * Cite: NeonPlug src/radios/dm32uv/constants.ts (facts only).
 */

/** Metadata byte at offset 0xFFF of each 4KB block. */
export const DM32_METADATA = {
  CHANNEL_FIRST: 0x12,
  CHANNEL_LAST: 0x41,
  ZONE: 0x5c,
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
  CONFIG_TG_COUNTER: 0x06,
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
  TALK_GROUP_COUNTER: 0x1ff,
} as const;

export const DM32_VFRAME = {
  FIRMWARE: 0x01,
  BUILD_DATE: 0x03,
  DSP_VERSION: 0x04,
  RADIO_VERSION: 0x05,
  MEMORY_LAYOUT: 0x0a,
  CODEPLUG_VERSION: 0x0b,
  CONTACTS: 0x0f,
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
  CHANNEL_MAX: 4000,
  CHANNELS_IN_FIRST_BLOCK: 84,
  CHANNELS_PER_LATER_BLOCK: 85,
} as const;

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
  DM32_METADATA.CONFIG_TG_COUNTER,
  DM32_METADATA.TX_CONTACT_LOW,
  DM32_METADATA.TX_CONTACT_HIGH,
];

export const DM32_MODEL_IDS = ['DM-32UV', 'DP570UV'] as const;

/**
 * Anytone AT-D890UV sparse memory constants (`D890_MAP`).
 * Cite: anytone-cps `anytone_memory.h` / `Device` (facts only).
 */

export const AT_D890UV_MODEL_IDS = ['AT-D890UV', 'ID890UV'] as const;

/** Family safe-skip write address (878-line radios; apply on D890 too). */
export const AT_D890_SAFE_SKIP_WRITE_ADDR = 0x2fa0010;

export const AT_D890_BLOCK_SIZE = 0x10;

export const AT_D890_CONNECTION = {
  BAUD_RATE: 921600,
  INTER_BLOCK_DELAY_MS: 5,
  TIMEOUT: {
    HANDSHAKE_MS: 8000,
    IDENT_MS: 8000,
    READ_MS: 10_000,
    WRITE_MS: 10_000,
  },
} as const;

export const AT_D890_LIMITS = {
  MAX_CHANNELS: 4000,
  CHANNEL_SET_BYTES: 0x200,
  ZONE_SET_BYTES: 0x20,
  ZONE_MEMBERS_BYTES: 0x200,
  ZONE_MAX_MEMBERS: 64,
  SCAN_LIST_SET_BYTES: 0x20,
  SCAN_LIST_RECORD_SIZE: 0xd0,
  SCAN_LIST_STRIDE: 0x200,
  RX_GROUP_SET_BYTES: 0x10,
  RX_GROUP_STRIDE: 0x200,
  RX_GROUP_RECORD_SIZE: 0x120,
  RADIO_ID_SET_BYTES: 0x20,
  RADIO_ID_STRIDE: 0x40,
  TALKGROUP_SET_BYTES: 0x4f0,
  /** Index pitch (`D890_MAP.TalkgroupDataOffset`); not the serial transfer length. */
  TALKGROUP_STRIDE: 0xc8,
  TALKGROUP_RECORD_SIZE: 0xc8,
  CHANNEL_RECORD_SIZE: 0x80,
  CHANNEL_CHUNK_SIZE: 0x40,
} as const;

/** `D890_MAP` — first-adapter subset. */
export const D890_MAP = {
  LocalInfo: 0x4f8_0000,
  LocalInfoLength: 0x100,
  ChannelSet: 0x3482_a00,
  ChannelData: 0x100_0000,
  ChannelDataOffset: 0x80,
  ChannelDataBlockSize: 128,
  ChannelDataBlockOffset: 0x80_000,
  /** Low half of each block — measured backed storage (upper half mirrors at +this). */
  ChannelDataBackedBytes: 0x4_0000,
  /** Alias period within a block: addr + this lands on addr. */
  ChannelDataAliasStride: 0x4_0000,
  /** Blocks in the ChannelData address span (`0x1000000 / ChannelDataBlockOffset`). */
  ChannelDataBlockCount: 32,
  ChannelDataSecondaryOffset: 0x40,
  ZoneSet: 0x3482_c00,
  ZoneHide: 0x3482_c20,
  ZonesName: 0x360_0000,
  ZoneDataOffset: 0x40,
  ZoneDataLength: 0x20,
  ZoneChannels: 0x200_0000,
  ZoneChannelsStride: 0x200,
  ZoneAChannel: 0x350_0400,
  ZoneBChannel: 0x350_0600,
  ZoneTableBytes: 0x200,
  RadioIdSet: 0x3482_c40,
  RadioIdData: 0x368_0000,
  RadioIdStride: 0x40,
  RadioIdLength: 0x40,
  ScanListSet: 0x3482_c60,
  ScanListData: 0x210_0000,
  ScanListStride: 0x200,
  ScanListLength: 0xd0,
  TalkgroupSet: 0x398_0000,
  TalkgroupData: 0x3a0_0000,
  TalkgroupStride: 0xc8,
  TalkgroupLength: 0xc8,
  TalkgroupOrder: 0x3f0_0000,
  ReceiveGroupSet: 0x370_1510,
  ReceiveGroupData: 0x378_0000,
  ReceiveGroupStride: 0x200,
  ReceiveGroupLength: 0x120,
  MasterIdData: 0x368_4000,
  MasterIdLength: 0x40,
  /** Optional settings (main) — Read/stash only; never serial-written. */
  OptionalSettingsMain: 0x350_0000,
  OptionalSettingsMainLength: 0x200,
  /** Optional settings (ext) — power-on password chars, display strings. */
  OptionalSettingsExt: 0x350_0900,
  OptionalSettingsExtLength: 0x60,
  /** Optional settings (APRS/GPS info) — hex preview only in Studio. */
  OptionalSettingsAprs: 0x350_1280,
  OptionalSettingsAprsLength: 0x30,
  /** Alarm call-type / TG bitmap — Read/stash only. */
  AlarmBitmap: 0x3482_e00,
  AlarmBitmapLength: 0x10,
  /** Alarm record bodies — Read/stash only. */
  AlarmData: 0x3483_000,
  AlarmDataLength: 0x30,
} as const;

/** Virtual MemoryMap span (absolute addresses; base 0). */
export const AT_D890_MAP_SIZE = 0x500_0000;

export const AT_D890_INVALID_U16 = 0xffff;

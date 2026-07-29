/**
 * Anytone AT-D890UV sparse memory constants (`D890_MAP`).
 * Cite: anytone-cps `anytone_memory.h` / `Device` (facts only).
 */

import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';

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
  MAX_CHANNELS: AT_D890UV_LIMITS.CHANNEL_MAX,
  CHANNEL_SET_BYTES: 0x200,
  ZONE_SET_BYTES: 0x20,
  ZONE_MEMBERS_BYTES: 0x200,
  ZONE_MAX_MEMBERS: AT_D890UV_LIMITS.ZONE_MEMBERS_MAX,
  SCAN_LIST_SET_BYTES: 0x20,
  SCAN_LIST_RECORD_SIZE: 0xfa,
  SCAN_LIST_STRIDE: 0x200,
  RX_GROUP_SET_BYTES: 0x20,
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
  ScanListLength: 0xfa,
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
  /** Optional GPS info string — not APRS config; hex preview + sentinel only. */
  OptionalSettingsAprs: 0x350_1280,
  OptionalSettingsAprsLength: 0x30,
  /** Alarm call-type / TG bitmap — Read/stash only. */
  AlarmBitmap: 0x3482_e00,
  AlarmBitmapLength: 0x10,
  /** Alarm record bodies — Read/stash only. */
  AlarmData: 0x3483_000,
  AlarmDataLength: 0x30,
  /** Full global APRS config — see aprs.md. */
  AprsConfigMain: 0x350_1000,
  AprsConfigMainLength: 0x260,
  /** 32 receive-filter records, `0x8` bytes each — RMW-preserved on Write. */
  AprsReceiveFilters: 0x350_1300,
  AprsReceiveFiltersLength: 0x100,
  /**
   * AM airband channels + VFO. 256 programmable slots + 1 VFO slot (index 256) —
   * `Memory::initAmAir` in anytone-cps. Sparse Read + Write (#756).
   */
  AmAirSet: 0x3884_200,
  AmAirSetLength: 0x20,
  AmAirData: 0x3880_000,
  AmAirDataStride: 0x40,
  AmAirDataLength: 0x40,
  AmAirCount: 256,
  AmAirVfo: 0x3884_000,
  AmAirVfoLength: 0x40,
  /**
   * AM airband zones. 16 zones — `Memory::initAmZones` in anytone-cps.
   * Record layout verified against a hardware dump reconciled with CPS CSV egress
   * 2026-07-28 — see memory-layout.md. `AmZone::encode_D890UV()` is still an empty-array
   * stub upstream; do not port it. Sparse Read + Write (#756).
   */
  AmZoneSet: 0x3884_400,
  AmZoneSetLength: 0x10,
  /**
   * A-channel per zone = **u16 LE index into that zone's member list**, not a global AM
   * channel index. Both facts verified on hardware: a sample with A-channels at member
   * positions 0/1/2 reads `00 00 01 00 02 00` — u8 would have given `00 01 02`, and a
   * global-index scheme would have given the members' global indices.
   *
   * anytone-cps reads u16 (correct) but **writes u8** into a `0x10` buffer, which lands
   * zone n's value on byte n instead of byte 2n — corrupting zone 0's high byte. Its `0x10`
   * read length also only covers 8 of the 16 zones. Do not port either.
   */
  AmZoneAChannel: 0x3884_600,
  AmZoneAChannelStride: 2,
  /** 16 zones × u16. Zones 8-15 are inferred from the stride — not yet sampled. */
  AmZoneAChannelLength: 0x20,
  /**
   * Scan membership: one bit per **member-list position** (not global channel index —
   * verified, see memory-layout.md), `0x4` bytes = 32 bits per zone, matching the 32 member
   * slots in the record. anytone-cps reads this at a `0x10` stride, which is wrong and makes
   * its own decode read outside the zone's slice for any zone after the first.
   */
  AmZoneScan: 0x3884_800,
  AmZoneScanStride: 0x4,
  /** 16 zones × 4 bytes. */
  AmZoneScanLength: 0x40,
  AmZoneData: 0x3888_000,
  AmZoneDataStride: 0x80,
  AmZoneDataLength: 0x80,
  AmZoneCount: 16,
  /** Zone name: UTF-16LE, max 16 chars, always NUL-terminated (terminator may sit at `0x20`). */
  AmZoneNameOffset: 0x0,
  AmZoneNameLength: 0x22,
  /** Member list: u16 LE per slot, `0xffff` = empty/terminator. */
  AmZoneMembersOffset: 0x22,
  AmZoneMemberSlots: 32,
  /**
   * Digital contact book. Huge, block-hopped bank — see memory-layout.md for the
   * linear-stream reconstruction formula. Read/decode/encode all exist in anytone-cps;
   * Studio deliberately never Reads or Writes this bank (#759, #753 allow-list).
   */
  DigitalContactMeta: 0x700_0000,
  DigitalContactMetaLength: 0x10,
  DigitalContactData: 0x790_0000,
  DigitalContactDataBlockLength: 0x30d40,
  DigitalContactDataStride: 0x8_0000,
  DigitalContactOrder: 0x708_0000,
  DigitalContactOrderBlockLength: 0x3e800,
  DigitalContactOrderBlockStride: 0x8_0000,
  /** Order-table entry: `u32` key (`(radioId<<1)|callType`) + `u32` data offset. */
  DigitalContactOrderEntrySize: 8,
} as const;

/** Virtual MemoryMap span (absolute addresses; base 0). */
export const AT_D890_MAP_SIZE = 0x500_0000;

export const AT_D890_INVALID_U16 = 0xffff;

/** APRS digital report channel sentinel — Current Channel (anytone-cps UI). */
export const AT_D890_APRS_CURRENT_CHANNEL_WIRE = 0x0fa2;

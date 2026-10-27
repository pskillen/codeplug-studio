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
  /**
   * Sleep after every ACKed 16-byte write frame. **0 = disabled, and that is correct.**
   *
   * B1 experiment E2 tested 5 ms on hardware (verify `14-38-44-317Z`) and it changed
   * nothing — same 1761/2929 mismatches, same units. The hypothesis rested on reading
   * anytone-cps's `waitForReadyRead(50)` as a per-block sleep; it is a *timeout*, so CPS
   * proceeds as soon as the ACK lands and was never paced. Pacing only makes Studio slower.
   *
   * Kept as a knob because the delay is applied per frame, not per `atD890WriteMemory`
   * call — the upload loop passes one 16-byte chunk per call, so the old
   * "between blocks within a call" gate silently disabled it entirely.
   */
  INTER_BLOCK_DELAY_MS: 0,
  TIMEOUT: {
    HANDSHAKE_MS: 8000,
    IDENT_MS: 8000,
    READ_MS: 10_000,
    WRITE_MS: 10_000,
  },
} as const;

export const AT_D890_LIMITS = {
  MAX_CHANNELS: AT_D890UV_LIMITS.CHANNEL_MAX,
  MAX_SATELLITES: AT_D890UV_LIMITS.SATELLITE_MAX,
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

/**
 * Dump / write-verify read spans — deliberately wider than {@link AT_D890UV_LIMITS}
 * encode caps so debug export can see hardware slots above modelled write limits.
 * Do not derive from product limits — that hides unmodelled occupancy (F23 / #845).
 */
export const AT_D890_DUMP_ZONES = 256;
export const AT_D890_DUMP_SCAN_LISTS = 256;
export const AT_D890_DUMP_RX_GROUP_LISTS = 256;

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
  /** Lists packed in one bank before the next {@link ScanListBankPitch}. */
  ScanListBankSize: 32,
  /** Address pitch from scan-list bank n to bank n+1. The gap is not payload. */
  ScanListBankPitch: 0x8_0000,
  TalkgroupSet: 0x398_0000,
  TalkgroupData: 0x3a0_0000,
  TalkgroupStride: 0xc8,
  /** Slots packed in one bank before the next {@link TalkgroupBankPitch}. */
  TalkgroupBankSize: 1000,
  /** Address pitch from talkgroup bank n to bank n+1. The gap is not payload. */
  TalkgroupBankPitch: 0x8_0000,
  TalkgroupLength: 0xc8,
  /** List-count position table. One u32 LE per slot; entry count is `TALK_GROUPS_MAX`. */
  TalkgroupPosition: 0x390_0000,
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
  /**
   * Settings-unit extents the firmware keeps across a settings save and re-defaults on a
   * frequency-range change (the stock V1.05 settings save writes only these extents; the settings loaders read the same ones).
   * Backup/Restore only; Write never stages them.
   */
  /** Carried tail of the first settings page; the MM9PDY settings store lives at `+0x200..+0x21F`. */
  SettingsStore: 0x350_0200,
  SettingsStoreLength: 0x200,
  /** DTMF list (the stock settings loader reads `+0x800`, `0x100` bytes). */
  DtmfList: 0x350_0800,
  DtmfListLength: 0x100,
  /** Carried tail after the password (`+0x940`, 8 bytes); no stock reader. */
  OptionalSettingsExtTail: 0x350_0960,
  OptionalSettingsExtTailLength: 0xa0,
  /** APRS text block runs `0x7A` bytes from `+0x1200`; `aprs-config` ends at `+0x125F`. */
  AprsTextTail: 0x350_1260,
  AprsTextTailLength: 0x20,
  /** GPS text is `0x42` bytes from `+0x1280` (the save and load paths use `0x42`; the factory default string is shorter); the ext span covers `0x30` of them. */
  GpsInfoTail: 0x350_12b0,
  GpsInfoTailLength: 0x50,
  /** 32 GPS zone-switch records of `0x20` bytes (meaning inferred). */
  GpsZoneSwitch: 0x350_2000,
  GpsZoneSwitchLength: 0x400,
  /** 8 APRS fixed-beacon names, `0x22` bytes UTF-16 each (`0x110` total). */
  AprsBeaconNames: 0x350_2400,
  AprsBeaconNamesLength: 0x110,
  /**
   * VFO A/B are channel slots 4000/4001 (`channelPrimaryAddress`), `0x80` bytes each. They are
   * normally bitmap-set and already read with the channels; the explicit read names them
   * `vfo-channels` and captures them even when the bitmap bits are clear.
   */
  VfoChannels: 0x1f8_1000,
  VfoChannelsLength: 0x100,
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
   * linear-stream reconstruction formula. Written on Write from Studio-owned erase units (no
   * read); see docs/reference/radios/anytone/at-d890uv/digital-contacts.md.
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

/**
 * Satellite keps write region (#856). Deliberately **not** part of `D890_MAP` above:
 * anytone-cps's own `Device::writeSatelliteData()` uses `0x4a80000` as a bare literal, not a
 * struct field on `D890_MAP` — see docs/reference/radios/anytone/at-d890uv/satellite-keps.md
 * ("Base address is D890-only and resolved, not carried over from another model"). Kept as a
 * sibling constant rather than folded into `D890_MAP` to preserve that source fact.
 *
 * Base address `0x4a80000` is erase-unit-aligned (unit 298 of `0x40000`-byte units) and sits
 * in a 59-unit gap (259-317) with no other `D890_MAP`-declared neighbour on either side — see
 * the doc's "Erase-unit safety" section. Not hardware-verified.
 */
export const AT_D890_SATELLITE = {
  BASE_ADDRESS: 0x4a8_0000,
  RECORD_STRIDE: 0x200,
} as const;

/**
 * MM9PDY channel location table (storage contract v1, owned by the firmware repo:
 * pskillen/anytone-d890-firmware#75). Deliberately **not** part of `D890_MAP`: stock code,
 * stock erase lists and the official CPS never name this pair. Studio addresses the A
 * half only; the radio's unit walk at `END` promotes the pending copy.
 *
 * Sits above {@link AT_D890_MAP_SIZE}, so it never lives in the write `MemoryMap`.
 * The upload stages it straight into the sparse cache.
 */
export const AT_D890_CHANNEL_LOCATION = {
  /** A half of the dedicated `0x40000` erase-unit pair. */
  BASE_ADDRESS: 0x5c0_0000,
  /** B half. Studio never addresses it. */
  PAIR_B_ADDRESS: 0x5c4_0000,
  HEADER_BYTES: 0x20,
  ENTRY_BYTES: 16,
  /** One entry per memory channel (VFOs excluded). */
  MAX_ENTRIES: AT_D890UV_LIMITS.CHANNEL_MAX,
  MAGIC: 'LOC1',
  VERSION: 1,
} as const;

/** Header plus every possible entry: the span Studio may write (`0xfa20`). */
export const AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES =
  AT_D890_CHANNEL_LOCATION.HEADER_BYTES +
  AT_D890_CHANNEL_LOCATION.ENTRY_BYTES * AT_D890_CHANNEL_LOCATION.MAX_ENTRIES;

/**
 * MM9PDY / NXDN codeplug regions (firmware RE, NXDN codeplug: records F292-F295, F300; page
 * `docs/reference/cps/records/nxdn.md` in the firmware repo). Deliberately **not** part of
 * `D890_MAP`: the stock Write never names them. The list is four erase units that the firmware
 * reads together (index, inverted set, records, order table); the RX groups are one unit of
 * 250 strides plus a positive bitmap. Each unit has its own A/B flag; Studio addresses the A
 * half and the radio's unit walk at `END` promotes the pending copy.
 *
 * The list and RX group units are written only by an MM9PDY intent built when the radio reports
 * NXDN enabled; a stock intent clears them from the cache and never sends them.
 */
export const AT_D890_NXDN = {
  /** Index table: 1000 x u32 LE (position to record slot), `FFFFFFFF` past the last entry. */
  ListIndex: 0x1800_0000,
  ListIndexEntries: 1000,
  ListIndexBytes: 4000,
  /** Inverted set (clear = used). The CPS writes `0x7E` bytes; the cache pads to the 16-byte block. */
  ListSet: 0x1808_0000,
  ListSetBytes: 0x7e,
  /** Records, one bank of up to 1000 x `0xC8`. */
  ListData: 0x1810_0000,
  ListRecordSize: 0xc8,
  /** Order table: `count` x (u32 key, u32 slot), sorted by key, padded to an even count with `FF` x 8. */
  ListOrder: 0x1818_0000,
  ListOrderEntryBytes: 8,
  /** RX groups: 250 x `0x200`; members at `+0x00` (64 x u32 LE slots), name at `+0x100` (`0x22` bytes). */
  RxGroupData: 0x04b8_0000,
  RxGroupStride: 0x200,
  RxGroupMemberBytes: 0x100,
  RxGroupNameOffset: 0x100,
  RxGroupNameBytes: 0x22,
  /** Positive bitmap (set = used), in the same erase unit as the data. */
  RxGroupSet: 0x04ba_0000,
  RxGroupSetBytes: 0x20,
} as const;

/** Largest span Studio may write into each NXDN list unit, rounded to the 16-byte block. */
export const AT_D890_NXDN_LIST_SET_SPAN_BYTES = 0x80;
export const AT_D890_NXDN_LIST_DATA_MAX_BYTES =
  AT_D890_NXDN.ListRecordSize * AT_D890UV_LIMITS.NXDN_LIST_MAX;
export const AT_D890_NXDN_LIST_ORDER_MAX_BYTES =
  AT_D890_NXDN.ListOrderEntryBytes * AT_D890UV_LIMITS.NXDN_LIST_MAX;
export const AT_D890_NXDN_RX_GROUP_DATA_MAX_BYTES =
  AT_D890_NXDN.RxGroupStride * AT_D890UV_LIMITS.NXDN_RX_GROUP_LISTS_MAX;

/** Virtual MemoryMap span (absolute addresses; base 0). */
export const AT_D890_MAP_SIZE = 0x500_0000;

export const AT_D890_INVALID_U16 = 0xffff;

/** APRS digital report channel sentinel — Current Channel (anytone-cps UI). */
export const AT_D890_APRS_CURRENT_CHANNEL_WIRE = 0x0fa2;

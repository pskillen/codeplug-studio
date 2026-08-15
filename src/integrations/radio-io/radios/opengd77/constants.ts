/**
 * OpenUV380 (DM-1701 / MD-9600) FLASH layout constants.
 * Cite: docs/reference/radios/opengd77/memory-layout.md;
 * qdmr openuv380_codeplug.hh / opengd77base_codeplug.hh (facts only; GPL-3).
 */

import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';

/** USB serial baud (qdmr opengd77_interface.cc). */
export const OPENGD77_BAUD_RATE = 115_200;

export const OPENGD77_BLOCK = 32;
export const OPENGD77_SECTOR = 4096;

/** FLASH mem-region code for 'R' requests. */
export const OPENGD77_MEM_FLASH = 0x01 as const;
/** FirmwareInfo mem code. */
export const OPENGD77_MEM_FIRMWARE_INFO = 0x09 as const;

/** OpenUV380 write type byte. */
export const OPENGD77_WRITE_VARIANT = 'X' as const;

/** Command flags ('C'). */
export const OPENGD77_CMD_SHOW_CPS = 0x00;
export const OPENGD77_CMD_CLOSE_CPS = 0x05;
export const OPENGD77_CMD_CONTROL = 0x06;
export const OPENGD77_CONTROL_SAVE_REBOOT = 0x00;
/** qdmr write_start: save settings and VFOs, no reboot. */
export const OPENGD77_CONTROL_SAVE_SETTINGS_AND_VFOS = 0x02;
/** qdmr write_start before FLASH programming. */
export const OPENGD77_CONTROL_FLASH_RED_LED = 0x04;

/** DM-1701 / RT-84 radioType values in FirmwareInfo. */
export const DM1701_RADIO_TYPES = Object.freeze([0x08, 0x0a] as const);

/** TYT MD-9600 / Retevis RT-90 radioType in FirmwareInfo. */
export const MD9600_RADIO_TYPES = Object.freeze([0x05] as const);

export type OpenGd77PowerStep = Readonly<{ percent: number; wire: number }>;

/**
 * Contiguous MemoryMap covers absolute FLASH [IMAGE_BASE, IMAGE_END).
 * Gaps between registered spans are filled 0xff and never transferred.
 */
export const OPENUV380_IMAGE_BASE = 0x0000_0080;
export const OPENUV380_IMAGE_END = 0x000a_ee60;
export const OPENUV380_IMAGE_SIZE = OPENUV380_IMAGE_END - OPENUV380_IMAGE_BASE;

/** Registered FLASH spans (qdmr openuv380_codeplug.cc ctor). */
export const OPENUV380_FLASH_SPANS = Object.freeze([
  { start: 0x0000_0080, length: 0x0000_5fe0 },
  { start: 0x0000_7500, length: 0x0000_3b00 },
  { start: 0x0002_0000, length: 0x11a0 },
  { start: 0x0009_b000, length: 0x0001_3e60 },
] as const);

/** Named region absolute FLASH bases. */
export const OPENUV380_OFFSET = Object.freeze({
  settings: 0x0000_0080,
  dtmfSettings: 0x0000_1470,
  aprsSettings: 0x0000_1588,
  dtmfContacts: 0x0000_2f88,
  channelBank0: 0x0000_3780,
  bootSettings: 0x0000_7518,
  vfoA: 0x0000_7590,
  vfoB: 0x0000_75c8,
  zoneBank: 0x0000_8010,
  additionalSettings: 0x0002_0000,
  channelBank1: 0x0009_b1b0,
  contacts: 0x000a_7620,
  groupLists: 0x000a_d620,
} as const);

export const OPENGD77_CHANNEL_RECORD_SIZE = 0x38;
export const OPENGD77_CHANNELS_PER_BANK = 128;
export const OPENGD77_CHANNEL_BANKS = 8;
/** Binary slot count (0..1023); CSV profile caps at 1023 export rows. */
export const OPENGD77_CHANNEL_SLOTS = OPENGD77_CHANNELS_PER_BANK * OPENGD77_CHANNEL_BANKS;
export const OPENGD77_CHANNEL_BANK_SIZE = 0x1c10;
export const OPENGD77_CHANNEL_BANK_BITMAP = 0x00;
export const OPENGD77_CHANNEL_BANK_RECORDS = 0x10;
export const OPENGD77_CHANNEL_NAME_LEN = OPENGD77_FAMILY_LIMITS.NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG;

export const OPENGD77_CONTACT_SIZE = 0x18;
export const OPENGD77_CONTACT_COUNT = OPENGD77_FAMILY_LIMITS.CONTACTS_MAX;
export const OPENGD77_CONTACT_NAME_LEN = OPENGD77_FAMILY_LIMITS.NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG;

/** OpenUV380 User Database / call-sign DB (qdmr OpenUV380CallsignDB Offset, not live dump). */
export const OPENUV380_USER_DB_HEADER_ABS = 0x0005_0000;
export const OPENUV380_USER_DB_HEADER_SIZE = 12;
export const OPENUV380_USER_DB_ENTRIES0_ABS =
  OPENUV380_USER_DB_HEADER_ABS + OPENUV380_USER_DB_HEADER_SIZE;
export const OPENUV380_USER_DB_ENTRIES1_ABS = 0x000d_8000;
export const OPENUV380_USER_DB_SIZE0 = 0x0004_0000;
export const OPENUV380_USER_DB_ENTRY_SIZE = 0x1b;
export const OPENUV380_USER_DB_TEXT_CHARS = 32;
/** Segment 0 capacity — integer division of size0 minus header. Not USER_DATABASE_MAX. */
export const OPENUV380_USER_DB_ENTRIES0_MAX = Math.floor(
  (OPENUV380_USER_DB_SIZE0 - OPENUV380_USER_DB_HEADER_SIZE) / OPENUV380_USER_DB_ENTRY_SIZE,
);
export const OPENGD77_USER_DATABASE_MAX = OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX;

export const OPENGD77_ZONE_SIZE = 0xb0;
export const OPENGD77_ZONE_COUNT = OPENGD77_FAMILY_LIMITS.ZONE_MAX;
export const OPENGD77_ZONE_MEMBERS = OPENGD77_FAMILY_LIMITS.ZONE_MEMBERS_MAX;
export const OPENGD77_ZONE_BANK_BITMAP = 0x00;
export const OPENGD77_ZONE_BANK_ZONES = 0x20;
export const OPENGD77_ZONE_NAME_LEN = OPENGD77_FAMILY_LIMITS.NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG;
export const OPENGD77_ZONE_BANK_SIZE = 0x20 + OPENGD77_ZONE_COUNT * OPENGD77_ZONE_SIZE;

export const OPENGD77_RX_GROUP_SIZE = 0x50;
export const OPENGD77_RX_GROUP_COUNT = OPENGD77_FAMILY_LIMITS.RX_GROUP_LISTS_MAX;
export const OPENGD77_RX_GROUP_MEMBERS = OPENGD77_FAMILY_LIMITS.RX_GROUP_MEMBERS_MAX;
export const OPENGD77_RX_GROUP_NAME_LEN = OPENGD77_FAMILY_LIMITS.RX_GROUP_NAME_LEN;
export const OPENGD77_RX_GROUP_BANK_SIZE = 0x1840;
export const OPENGD77_RX_GROUP_LENGTH_TABLE = 0x00;
export const OPENGD77_RX_GROUP_LISTS_START = 0x80;

export const OPENGD77_SETTINGS_SIZE = 0x90;
export const OPENGD77_VFO_SIZE = OPENGD77_CHANNEL_RECORD_SIZE;

export const OPENGD77_IO_TIMEOUT_MS = 5000;
export const OPENGD77_IDENT_TIMEOUT_MS = 8000;

/**
 * P1…P9 binary power steps (1…9) ↔ Studio percent — same ladder as opengd77-1701 CSV.
 * Wire byte 0 = Master / radio default.
 */
export const OPENGD77_1701_POWER_STEPS = Object.freeze([
  { percent: 1, wire: 1 },
  { percent: 5, wire: 2 },
  { percent: 10, wire: 3 },
  { percent: 15, wire: 4 },
  { percent: 20, wire: 5 },
  { percent: 40, wire: 6 },
  { percent: 60, wire: 7 },
  { percent: 80, wire: 8 },
  { percent: 100, wire: 9 },
] as const satisfies readonly OpenGd77PowerStep[]);

/**
 * MD-9600 / RT-90 binary power steps — mirrors `OPENGD77_MD9600_LADDER` in profiles.ts (#441).
 * Wire byte 0 = Master / radio default. Menu `+W-` (User Power) is not encoded.
 */
export const OPENGD77_MD9600_POWER_STEPS = Object.freeze([
  { percent: 1, wire: 1 },
  { percent: 2, wire: 2 },
  { percent: 3, wire: 3 },
  { percent: 4, wire: 4 },
  { percent: 5, wire: 5 },
  { percent: 13, wire: 6 },
  { percent: 25, wire: 7 },
  { percent: 63, wire: 8 },
  { percent: 100, wire: 9 },
] as const satisfies readonly OpenGd77PowerStep[]);

/** Map absolute FLASH address → offset in contiguous MemoryMap. */
export function openUv380AbsToOffset(abs: number): number {
  if (abs < OPENUV380_IMAGE_BASE || abs >= OPENUV380_IMAGE_END) {
    throw new RangeError(
      `OpenUV380 address 0x${abs.toString(16)} outside image [0x${OPENUV380_IMAGE_BASE.toString(16)}, 0x${OPENUV380_IMAGE_END.toString(16)})`,
    );
  }
  return abs - OPENUV380_IMAGE_BASE;
}

/** Map MemoryMap offset → absolute FLASH address. */
export function openUv380OffsetToAbs(offset: number): number {
  return OPENUV380_IMAGE_BASE + offset;
}

/** Absolute base of channel bank `bankIndex` (0…7). */
export function openUv380ChannelBankAbs(bankIndex: number): number {
  if (bankIndex < 0 || bankIndex >= OPENGD77_CHANNEL_BANKS) {
    throw new RangeError(`Channel bank index ${bankIndex} out of range`);
  }
  if (bankIndex === 0) return OPENUV380_OFFSET.channelBank0;
  return OPENUV380_OFFSET.channelBank1 + (bankIndex - 1) * OPENGD77_CHANNEL_BANK_SIZE;
}

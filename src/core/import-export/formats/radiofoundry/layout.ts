/**
 * Open-firmware codeplug image layout.
 * File offset is the STM32 wire address (RadioFoundry docs/spec/tftp.md §3 and
 * docs/spec/open-firmware-cps.md §7). Cardinality lives in DM32UV_RADIOFOUNDRY_LIMITS.
 */

/** codeplug.bin length. The file stops at the end of the RX-list region. */
export const RADIOFOUNDRY_IMAGE_SIZE = 0xaee60;

export const RADIOFOUNDRY_CODEPLUG_FILE_NAME = 'codeplug.bin';

/** General settings: radio name at +0 (8 bytes), DMR ID at +8 (4 bytes BCD, big endian). */
export const GENERAL_SETTINGS = 0x00e0;

export const BANK0_BITMAP = 0x3780;
/** First flash-image channel bank (channels 129–256): bitmap, then 56-byte records. */
export const CHANNEL_BANKS_BITMAP = 0x9b1b0;
export const CHANNELS_PER_BANK = 128;
export const CHANNEL_RECORD_SIZE = 56;
export const CHANNEL_BANK_STRIDE = 16 + CHANNELS_PER_BANK * CHANNEL_RECORD_SIZE;

/** Zone in-use bitmap. The 68 records follow immediately. */
export const ZONE_BITMAP = 0x8010;
export const ZONE_BITMAP_SIZE = 0x20;
export const ZONE_RECORD_SIZE = 0xb0;

/**
 * Layout selector at the high byte of zone 0's 24th member (spec §7.2).
 * 0x00–0x04 is the 80-channel record. 0xFF is the 16-channel record.
 */
export const ZONE_LAYOUT_BYTE = 0x806f;

/** Open-firmware 16-channel zone record. 68 of these (spec §7.2). */
export const ZONE_RECORD_SIZE_16 = 0x30;

export const CONTACT_BASE = 0xa7620;
export const CONTACT_RECORD_SIZE = 24;

/** 0 = unused list. Otherwise the member count plus 1. Padded to 128 bytes. */
export const RX_LIST_LENGTH = 0xad620;
export const RX_LIST_LENGTH_SIZE = 0x80;
export const RX_LIST_BASE = 0xad6a0;
export const RX_LIST_RECORD_SIZE = 80;

/** Squelch byte: 0 = radio default, 1–21 = level. */
export const SQUELCH_LEVEL_MAX = 21;

/** Per-channel DMR ID override is a 24-bit integer. */
export const PER_CHANNEL_DMR_ID_MAX = 0xff_ffff;

/** DMR all-call talk group. Stored with call type 2. */
export const ALL_CALL_DMR_ID = 16_777_215;

export const VHF_MIN_HZ = 136_000_000;
export const VHF_MAX_HZ = 174_000_000;
export const UHF_MIN_HZ = 400_000_000;
export const UHF_MAX_HZ = 480_000_000;

export function channelSlotAddress(number: number): {
  bitmap: number;
  bitIndex: number;
  record: number;
} {
  const index = number - 1;
  const bank = Math.floor(index / CHANNELS_PER_BANK);
  const within = index % CHANNELS_PER_BANK;
  const bitmap =
    bank === 0 ? BANK0_BITMAP : CHANNEL_BANKS_BITMAP + (bank - 1) * CHANNEL_BANK_STRIDE;
  return {
    bitmap,
    bitIndex: within,
    record: bitmap + 16 + within * CHANNEL_RECORD_SIZE,
  };
}

/**
 * Bits a cable write must leave as the radio had them. The same byte also
 * holds fields Studio writes, so the overlay keeps these bits and replaces
 * the rest. SFR payload and the per-channel timeout are whole bytes and are
 * left unowned instead.
 */
const CHANNEL_KEPT_BITS: Readonly<Record<number, number>> = {
  /** No beep, no power saving, out of band, SFR enable, roaming. */
  0x26: 0x73,
  /** Talker-alias bits other than the text bit of each timeslot. */
  0x30: 0xf5,
  /** Flag bits other than timeslot 2. */
  0x31: 0xbf,
  /** Vendor power, VOX, talkaround, vendor squelch. */
  0x33: 0xc9,
};

/** Preserve mask for one image address, or 0 when the address is not one of those flag bytes. */
export function channelKeptBits(addr: number): number {
  const offset = channelRecordOffset(addr);
  if (offset == null) return 0;
  return CHANNEL_KEPT_BITS[offset] ?? 0;
}

function channelRecordOffset(addr: number): number | null {
  const banks = Math.ceil(1024 / CHANNELS_PER_BANK);
  for (let bank = 0; bank < banks; bank += 1) {
    const bitmap =
      bank === 0 ? BANK0_BITMAP : CHANNEL_BANKS_BITMAP + (bank - 1) * CHANNEL_BANK_STRIDE;
    const start = bitmap + 16;
    const end = start + CHANNELS_PER_BANK * CHANNEL_RECORD_SIZE;
    if (addr < start || addr >= end) continue;
    return (addr - start) % CHANNEL_RECORD_SIZE;
  }
  return null;
}

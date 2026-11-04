/**
 * Synthetic RT95 EEPROM images built from the stock CPS's documented encodings (#1465).
 *
 * Tests only. Everything here is derived from the firmware repo's CPS reference (findings
 * F110-F130: channel record F121-F123 and F125, settings F124, bitmaps, zero-fill F126). It is
 * written independently of the Studio codec on purpose, so a test that decodes one of these images
 * (or parses a Studio-encoded record with {@link parseCpsChannelRecord}) checks Studio against the
 * CPS's meaning, not against itself. No owner dump, no vendor bytes and no calibration are used.
 */

import { RT95_CHANNEL_RECORD_SIZE, RT95_IMAGE_SIZE } from '../constants.ts';

const OCCUPIED_BITMAP = 0x1940;
const SCAN_BITMAP = 0x1960;
const BANDLIMIT_ADDR = 0x326d;

export interface CpsDcs {
  /** The code as printed, octal digits read as a decimal number: D023 is 23. */
  readonly code: number;
  readonly invert?: boolean;
}

/** One channel in the CPS's own terms (byte meanings from records/channel.md). */
export interface CpsChannelSpec {
  /** 1-200. */
  readonly slot: number;
  readonly rxHz: number;
  /** Bytes 4-7: an offset for slots 1-200. */
  readonly offsetHz?: number;
  /** Byte 9 bits 1-0: 0 none, 1 plus, 2 minus, 3 split. */
  readonly duplex?: 0 | 1 | 2 | 3;
  /** Byte 9 bits 3-2: 0 Low, 1 Middle, 2 High. */
  readonly power?: 0 | 1 | 2;
  /** Byte 10 bits 3-2: 0 = 12.5 kHz, 1 = 20 kHz, 2 = 25 kHz. */
  readonly width?: 0 | 1 | 2;
  /** Byte 10 bit 0 (CPS "TxForbid"). */
  readonly txOff?: boolean;
  /** Byte 10 bit 1. */
  readonly reverse?: boolean;
  /** Byte 9 bit 4 and bit 7: modelled flags with an unresolved UI name. */
  readonly flag9b4?: boolean;
  readonly flag9b7?: boolean;
  /** Byte 11 bits 1-0 (TX) and 3-2 (RX): 0 Off, 1 CTCSS, 2 DCS. */
  readonly encodeMode?: 0 | 1 | 2;
  readonly decodeMode?: 0 | 1 | 2;
  /** Bytes 13 (encode) and 12 (decode): index into the 51-tone list; 0x33 is custom. */
  readonly ctcssEncodeIndex?: number;
  readonly ctcssDecodeIndex?: number;
  /** Bytes 16-17 (encode) and 14-15 (decode). */
  readonly dcsEncode?: CpsDcs;
  readonly dcsDecode?: CpsDcs;
  /** Byte 11 bits 7-4: DTMF ID index (0-based). */
  readonly dtmfId?: number;
  /** Byte 18: busy-channel lockout. Byte 19, byte 22: modelled whole bytes, meaning unresolved. */
  readonly byte18?: number;
  readonly byte19?: number;
  readonly byte22?: number;
  /** Byte 20: bit 0 is tone squelch. */
  readonly byte20?: number;
  /** Byte 21: optional signalling selector, 0 Off, 1 DTMF, 3 5-Tone. */
  readonly optionalSignalling?: number;
  /** Byte 23: 5-Tone ID index. */
  readonly fiveToneId?: number;
  /** Bytes 30-31: custom CTCSS in 0.1 Hz, little endian. */
  readonly customCtcssDeciHz?: number;
  /** Byte 8: never read or written by the CPS. */
  readonly byte8?: number;
  /** Six name bytes as characters; '\0' is allowed (a NUL after a short name). */
  readonly name: string;
  /** Scan bitmap bit ("Add"). */
  readonly scanAdd?: boolean;
}

/** BCD as the CPS stores it: 8 digits, byte 0 the most significant pair, unit 10 Hz. */
function bcd10Hz(hz: number): number[] {
  const digits = String(Math.round(hz / 10)).padStart(8, '0');
  return [0, 2, 4, 6].map((i) => parseInt(digits.slice(i, i + 2), 16));
}

/** The DCS word: the code's octal digits read as a binary number; bit 9 is invert. */
function dcsWord(dcs: CpsDcs | undefined): number {
  if (!dcs) return 0;
  return parseInt(String(dcs.code), 8) | (dcs.invert ? 0x200 : 0);
}

/** One 32-byte slot, as a CPS Write would send it (bytes it never stores are 0x00). */
export function cpsChannelRecord(c: CpsChannelSpec): Uint8Array {
  const r = new Uint8Array(RT95_CHANNEL_RECORD_SIZE);
  r.set(bcd10Hz(c.rxHz), 0);
  r.set(bcd10Hz(c.offsetHz ?? 0), 4);
  r[8] = c.byte8 ?? 0;
  r[9] = (c.duplex ?? 0) | ((c.power ?? 2) << 2) | (c.flag9b4 ? 0x10 : 0) | (c.flag9b7 ? 0x80 : 0);
  r[10] = (c.txOff ? 1 : 0) | (c.reverse ? 2 : 0) | ((c.width ?? 2) << 2);
  r[11] = (c.encodeMode ?? 0) | ((c.decodeMode ?? 0) << 2) | ((c.dtmfId ?? 0) << 4);
  r[12] = c.ctcssDecodeIndex ?? 0;
  r[13] = c.ctcssEncodeIndex ?? 0;
  const dcsDec = dcsWord(c.dcsDecode);
  const dcsEnc = dcsWord(c.dcsEncode);
  r[14] = dcsDec & 0xff;
  r[15] = dcsDec >> 8;
  r[16] = dcsEnc & 0xff;
  r[17] = dcsEnc >> 8;
  r[18] = c.byte18 ?? 0;
  r[19] = c.byte19 ?? 0;
  r[20] = c.byte20 ?? 0;
  r[21] = c.optionalSignalling ?? 0;
  r[22] = c.byte22 ?? 0;
  r[23] = c.fiveToneId ?? 0;
  for (let i = 0; i < 6; i++) r[24 + i] = c.name.charCodeAt(i);
  r[30] = (c.customCtcssDeciHz ?? 0) & 0xff;
  r[31] = (c.customCtcssDeciHz ?? 0) >> 8;
  return r;
}

export interface CpsImageOptions {
  /** Band code at 0x326D (the CPS never writes it; a Read returns the radio's). Default 1. */
  readonly bandlimit?: number;
}

/**
 * A 0x32A0 image the way a CPS Read of a programmed radio looks: zero-filled, occupied slots in
 * place, absent slots 0xFF, occupied and scan bitmaps set (channel n is byte (n-1)>>3, bit (n-1)&7).
 */
export function buildCpsImage(
  channels: readonly CpsChannelSpec[],
  opts: CpsImageOptions = {},
): Uint8Array {
  const image = new Uint8Array(RT95_IMAGE_SIZE);
  image.fill(0xff, 0, 200 * RT95_CHANNEL_RECORD_SIZE);
  image.fill(0x00, 200 * RT95_CHANNEL_RECORD_SIZE);
  for (const c of channels) {
    image.set(cpsChannelRecord(c), (c.slot - 1) * RT95_CHANNEL_RECORD_SIZE);
    const byte = (c.slot - 1) >> 3;
    const bit = 1 << ((c.slot - 1) & 7);
    image[OCCUPIED_BITMAP + byte] = image[OCCUPIED_BITMAP + byte]! | bit;
    if (c.scanAdd) image[SCAN_BITMAP + byte] = image[SCAN_BITMAP + byte]! | bit;
  }
  image[BANDLIMIT_ADDR] = opts.bandlimit ?? 0x01;
  return image;
}

/** A 32-byte record read back by the CPS's meaning (the direction-B parser). */
export interface CpsChannelView {
  readonly rxHz: number;
  readonly offsetHz: number;
  readonly duplex: number;
  readonly power: number;
  readonly width: number;
  readonly txOff: boolean;
  readonly encodeMode: number;
  readonly decodeMode: number;
  readonly ctcssEncodeIndex: number;
  readonly ctcssDecodeIndex: number;
  readonly dcsEncodeCode: number;
  readonly dcsEncodeInvert: boolean;
  readonly dcsDecodeCode: number;
  readonly dcsDecodeInvert: boolean;
  readonly dtmfId: number;
  readonly byte8: number;
  readonly optionalSignalling: number;
  readonly fiveToneId: number;
  readonly customCtcssDeciHz: number;
  /** The six name bytes. */
  readonly nameBytes: number[];
}

function bcdToHz(b: ArrayLike<number>): number {
  let digits = '';
  for (let i = 0; i < 4; i++) digits += b[i]!.toString(16).padStart(2, '0');
  return parseInt(digits, 10) * 10;
}

/** A DCS word to the printed code (octal digits of the low 9 bits read as decimal). */
function dcsCode(word: number): number {
  return parseInt((word & 0x1ff).toString(8), 10);
}

export function parseCpsChannelRecord(r: Uint8Array): CpsChannelView {
  const word = (lo: number) => r[lo]! | (r[lo + 1]! << 8);
  return {
    rxHz: bcdToHz(r.subarray(0, 4)),
    offsetHz: bcdToHz(r.subarray(4, 8)),
    duplex: r[9]! & 3,
    power: (r[9]! >> 2) & 3,
    width: (r[10]! >> 2) & 3,
    txOff: (r[10]! & 1) === 1,
    encodeMode: r[11]! & 3,
    decodeMode: (r[11]! >> 2) & 3,
    ctcssEncodeIndex: r[13]!,
    ctcssDecodeIndex: r[12]!,
    dcsEncodeCode: dcsCode(word(16)),
    dcsEncodeInvert: (word(16) & 0x200) !== 0,
    dcsDecodeCode: dcsCode(word(14)),
    dcsDecodeInvert: (word(14) & 0x200) !== 0,
    dtmfId: r[11]! >> 4,
    byte8: r[8]!,
    optionalSignalling: r[21]!,
    fiveToneId: r[23]!,
    customCtcssDeciHz: word(30),
    nameBytes: [...r.subarray(24, 30)],
  };
}

/**
 * What the stock CPS shows for a name byte: a digit, A-Z or `-` is kept, anything else (lower
 * case, space, punctuation, NUL) becomes a space; the six are right-trimmed (F122).
 */
export function cpsNameView(bytes: ArrayLike<number>): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    const ch = String.fromCharCode(bytes[i]!);
    out += /[0-9A-Z-]/.test(ch) ? ch : ' ';
  }
  return out.replace(/\s+$/, '');
}

const MHZ = 1_000_000;

/** Hz for a MHz figure, without float residue (145.6 * 1e6 is not exact). */
export const mhz = (x: number): number => Math.round(x * MHZ);

/**
 * The channel fixtures, one per behaviour the brief lists. Slot numbers are stable: tests and
 * docs/reference/radios/retevis/rt95/fixtures.md refer to them by name.
 */
export const CPS_CHANNEL_FIXTURES = {
  /** Width 12.5, power Low, simplex, no tones. */
  narrowLow: { slot: 1, rxHz: 145.5 * MHZ, width: 0, power: 0, name: 'NFM-01', scanAdd: true },
  /** Width 25, power Middle, plus duplex. */
  widePlus: {
    slot: 2,
    rxHz: 145.6 * MHZ,
    offsetHz: 0.6 * MHZ,
    duplex: 1,
    width: 2,
    power: 1,
    name: 'FM-02',
  },
  /** Width 25, power High, minus duplex on UHF with a 7.6 MHz offset. */
  uhfMinus: {
    slot: 3,
    rxHz: 438.8 * MHZ,
    offsetHz: 7.6 * MHZ,
    duplex: 2,
    width: 2,
    power: 2,
    name: 'UHF-03',
  },
  /** Duplex 3 (split): rx only is asserted, the offset meaning on slots 1-200 is open (O2). */
  split: { slot: 4, rxHz: 433.5 * MHZ, offsetHz: 433.6 * MHZ, duplex: 3, name: 'SPLIT4' },
  /** TX off (receive only) with the reverse flag and both unresolved flags set. */
  rxOnly: {
    slot: 5,
    rxHz: 162.55 * MHZ,
    txOff: true,
    reverse: true,
    flag9b4: true,
    flag9b7: true,
    name: 'WX-5',
  },
  /** CTCSS encode and decode on different indexes (TX 88.5, RX 100.0). */
  ctcssPair: {
    slot: 6,
    rxHz: 145.775 * MHZ,
    encodeMode: 1,
    decodeMode: 1,
    ctcssEncodeIndex: 0x09,
    ctcssDecodeIndex: 0x0d,
    byte20: 0x01,
    name: 'CTCSS6',
  },
  /** DCS normal on encode, DCS inverted on decode (a code with the ninth bit set). */
  dcsMixed: {
    slot: 7,
    rxHz: 145.8 * MHZ,
    encodeMode: 2,
    decodeMode: 2,
    dcsEncode: { code: 23 },
    dcsDecode: { code: 754, invert: true },
    byte20: 0x01,
    name: 'DCS-7',
  },
  /** CTCSS encode with DCS decode. */
  toneCross: {
    slot: 8,
    rxHz: 145.9 * MHZ,
    encodeMode: 1,
    decodeMode: 2,
    ctcssEncodeIndex: 0x0d,
    dcsDecode: { code: 25 },
    name: 'CROSS8',
  },
  /** Name with characters outside the CPS charset: lower case, slash, dot. */
  oddName: { slot: 9, rxHz: 146.0 * MHZ, name: 'lo/er.' },
  /** A short name the CPS pads as characters, NUL, spaces (inferred order, Q19). */
  nulName: { slot: 10, rxHz: 146.1 * MHZ, name: 'AB\0   ' },
  /** A name with an inner space and the longest length. */
  spacedName: { slot: 11, rxHz: 146.2 * MHZ, name: 'A B-12' },
  /** Documented loss: width 1 (20 kHz) reads as 25 kHz (B3). */
  width20: { slot: 12, rxHz: 146.3 * MHZ, width: 1, name: 'W20K12' },
  /** Documented loss: a custom CTCSS tone (index 0x33, value in bytes 30-31) reads as no tone. */
  customCtcss: {
    slot: 13,
    rxHz: 146.4 * MHZ,
    encodeMode: 1,
    decodeMode: 1,
    ctcssEncodeIndex: 0x33,
    ctcssDecodeIndex: 0x33,
    customCtcssDeciHz: 885,
    name: 'CUST13',
  },
  /**
   * CPS-explained bytes Studio does not model: byte 8, optional signalling, DTMF ID, 5-Tone ID,
   * lockout and the unresolved whole bytes 19 and 22.
   */
  unmodelled: {
    slot: 14,
    rxHz: 146.5 * MHZ,
    byte8: 0x5a,
    dtmfId: 0x7,
    optionalSignalling: 3,
    fiveToneId: 12,
    byte18: 2,
    byte19: 0x35,
    byte22: 0x44,
    name: 'UNMOD',
    scanAdd: true,
  },
  /** The last slot of the range (slot 1 is `narrowLow`). */
  lastSlot: { slot: 200, rxHz: 146.7 * MHZ, name: 'LAST', scanAdd: true },
} satisfies Record<string, CpsChannelSpec>;

/** All 51 CTCSS indexes, one channel each: TX index n, RX index (n + 7) mod 51. Slots 21-71. */
export function cpsCtcssSweep(): CpsChannelSpec[] {
  return Array.from({ length: 51 }, (_, n) => ({
    slot: 21 + n,
    rxHz: 147.0 * MHZ + n * 12_500,
    encodeMode: 1 as const,
    decodeMode: 1 as const,
    ctcssEncodeIndex: n,
    ctcssDecodeIndex: (n + 7) % 51,
    byte20: 0x01,
    name: `T${String(n).padStart(2, '0')}`,
  }));
}

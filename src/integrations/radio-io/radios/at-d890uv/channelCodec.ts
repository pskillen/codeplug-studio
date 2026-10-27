/**
 * AT-D890UV 0x80 channel record encode/decode.
 * Cite: anytone-cps `Channel::encode_D890UV` / `decode_D890UV` (facts only).
 */

import type { MemoryMap } from '../../types.ts';
import type {
  RadioChannelDto,
  RadioChannelMode,
  RadioChannelNxdnDto,
  RadioTone,
} from '../../radioChannelDto.ts';
import { encodeBcdFrequencyHz, decodeBcdFrequencyHz } from './bcd.ts';
import { assertAtD890MrChannelFrequencies, assertAtD890NxdnRan } from './channelEncodeGuards.ts';
import { clearBitmapBitsBelow, listSetBits, setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import {
  cacheToMemoryMap,
  channelPrimaryAddress,
  channelSecondaryAddress,
  getCacheBytes,
  mergeMapRegionsIntoCache,
  putCacheBytes,
  type AtD890DownloadCache,
} from './memory.ts';
import { encodeWideCharName, decodeWideCharName } from './wideChar.ts';
import { ctcssHzFromIndex, ctcssIndexFromHz } from './ctcssToneTable.ts';

/** Wire sentinel for no scan list / no RX group on D890 channel bytes `0x1b` / `0x1c`. */
const WIRE_INDEX_NONE = 0xff;

/**
 * Byte `0x21` (qDMR ChannelElement; forensic HEALTHY_CHANNEL_RECORDS).
 * anytone-cps swapped timeslot vs SMS confirm — do not copy that mapping.
 */
const BYTE_21_TIMESLOT_BIT = 0;
const BYTE_21_SMS_CONFIRM_BIT = 1;
/** DCDM / Dual-TS / TS-split — keep 0 for modelled DMO and repeater. */
const BYTE_21_DCDM_MASK = 0x0c;
const BYTE_21_APRS_RX_BIT = 5;
/** Digital DMO vs repeater (CPS-written SoT): `1` = DMO/simplex, `0` = repeater. */
const BYTE_34_DMO_BIT = 1;
/** CPS RX-only. Not `0x09` bit 5 (that bit is TX/PTT prohibit and stays clear). */
const BYTE_34_RX_ONLY_BIT = 3;
/** Auto scan ("start scanning on channel select"), not scan-list membership. */
const BYTE_34_AUTO_SCAN_BIT = 4;
/**
 * Unmodelled `0x34` bits copied from a downloaded slot.
 * Bit 0 ranging, bit 2 exclude-from-roaming, bit 5 idle TX, bit 6 compander, bit 7 DMR CRC ignore.
 * Bits 1 (DMO), 3 (RX-only), and 4 (auto scan) stay on the DTO.
 */
const BYTE_34_PRESERVE_MASK = (1 << 0) | (1 << 2) | (1 << 5) | (1 << 6) | (1 << 7);

/** Inclusive start, exclusive end. Modelled bytes are written after this copy. */
const CHANNEL_PRESERVE_RANGES: readonly (readonly [number, number])[] = [
  [0x10, 0x13],
  [0x19, 0x1b],
  [0x1d, 0x20],
  [0x22, 0x23],
  [0x36, 0x37],
  [0x39, 0x42],
  [0x66, 0x6f],
];

/**
 * NXDN channel bytes (firmware RE, NXDN codeplug answers), all inside the preserved
 * `0x66`-`0x6e` range. Studio writes only the three below; the rest are carried over.
 * `0x66` bit 0 = bandwidth (0 = 6.25 kHz NXDN48, 1 = 12.5 kHz NXDN96); `0x68` = TX RAN;
 * `0x69` = RX RAN; `0x6b` = RX group list (0-based, `0xff` = none, `0` would select list 0).
 */
const NXDN_FIRST_BYTE = 0x66;
const NXDN_LAST_BYTE = 0x6e;
const NXDN_BYTE_RATE = 0x66;
const NXDN_RATE_BIT = 0;
const NXDN_BYTE_TX_RAN = 0x68;
const NXDN_BYTE_RX_RAN = 0x69;
const NXDN_BYTE_RX_GROUP = 0x6b;
const NXDN_BYTE_PTT_CALL = 0x67;
const NXDN_PTT_CALL_SHIFT = 4;
const NXDN_BYTE_TX_CONTACT = 0x6c;
const NXDN_BYTE_ENCRYPTION = 0x6a;
const NXDN_BYTE_STATUS = 0x6e;

function setBit(byte: number, bit: number, value: boolean): number {
  return value ? (byte | (1 << bit)) & 0xff : byte & ~(1 << bit) & 0xff;
}

/**
 * Modelled `0x34` bits always come from the DTO. `setBit` leaves the other bits alone
 * so a later preserve copy of ranging / roaming / idle TX / compander / CRC-ignore survives.
 */
function applyModelledByte34(data: Uint8Array, ch: RadioChannelDto): void {
  const digitalDmo = hasDigitalHalf(ch.mode) && ch.dmrOperatingMode === 'dmo-simplex';
  data[0x34] = setBit(data[0x34]!, BYTE_34_DMO_BIT, digitalDmo);
  data[0x34] = setBit(data[0x34]!, BYTE_34_RX_ONLY_BIT, ch.rxOnly === true);
  data[0x34] = setBit(data[0x34]!, BYTE_34_AUTO_SCAN_BIT, ch.scanAdd === true);
}

/** Vacant, truncated, or virgin-`0xff` buffers are not a downloaded channel. */
function channelPriorIsAbsent(prior: Uint8Array): boolean {
  if (prior.length < AT_D890_LIMITS.CHANNEL_RECORD_SIZE) return true;
  const record = prior.subarray(0, AT_D890_LIMITS.CHANNEL_RECORD_SIZE);
  let allFf = true;
  for (let i = 0; i < record.length; i++) {
    if (record[i] !== 0xff) {
      allFf = false;
      break;
    }
  }
  if (allFf) return true;
  return decodeBcdFrequencyHz(record.subarray(0, 4)) === 0;
}

function copyPreservedChannelBytes(data: Uint8Array, prior: Uint8Array): void {
  for (const [start, end] of CHANNEL_PRESERVE_RANGES) {
    data.set(prior.subarray(start, end), start);
  }
  data[0x34] = (data[0x34]! & ~BYTE_34_PRESERVE_MASK) | (prior[0x34]! & BYTE_34_PRESERVE_MASK);
}

/** Primary and secondary halves of channel `idx` (0-based) as one `0x80` record. */
export function readCombinedChannelRecord(image: MemoryMap, idx: number): Uint8Array {
  const combined = new Uint8Array(AT_D890_LIMITS.CHANNEL_RECORD_SIZE);
  combined.set(image.get(channelPrimaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE), 0);
  combined.set(
    image.get(channelSecondaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    AT_D890_LIMITS.CHANNEL_CHUNK_SIZE,
  );
  return combined;
}

function decodeToneFromCtcssIndex(index: number): RadioTone {
  if (index === 0) return { kind: 'none' };
  const hz = ctcssHzFromIndex(index);
  if (hz == null) return { kind: 'none' };
  return { kind: 'ctcss', hz };
}

function decodeToneFromDcsU16(low: number, high: number): RadioTone {
  const word = low | (high << 8);
  const binary = word & 0x1ff;
  if (word === 0 || binary === 0) return { kind: 'none' };
  // RadioTone.code is the octal numeral (D023 → 23). The word stores that octal value as a binary integer.
  const code = Number.parseInt(binary.toString(8), 10);
  if (code === 0) return { kind: 'none' };
  return { kind: 'dcs', code, polarity: (word & 0x200) !== 0 ? 'I' : 'N' };
}

function encodeDcsTone(tone: RadioTone): { low: number; high: number } {
  if (tone.kind !== 'dcs') return { low: 0, high: 0 };
  const digits = String(Math.trunc(tone.code));
  if (!/^[0-7]+$/.test(digits)) return { low: 0, high: 0 };
  const binary = Number.parseInt(digits, 8) & 0x1ff;
  if (binary === 0) return { low: 0, high: 0 };
  const word = binary + (tone.polarity === 'I' ? 512 : 0);
  return { low: word & 0xff, high: (word >> 8) & 0xff };
}

function modeFromWire(n: number): RadioChannelMode {
  const map: RadioChannelMode[] = ['analog', 'digital', 'fixed-analog', 'fixed-digital'];
  return map[n] ?? 'analog';
}

function wireFromMode(mode: RadioChannelMode | undefined): number {
  switch (mode) {
    case 'digital':
      return 1;
    case 'fixed-analog':
      return 2;
    case 'fixed-digital':
      return 3;
    default:
      return 0;
  }
}

function isDigitalMode(mode: RadioChannelMode | undefined): boolean {
  return mode === 'digital' || mode === 'fixed-digital';
}

/** D-Digital, A+D TX A or D+A TX D: the channel has a DMR half whose settings are written. */
function hasDigitalHalf(mode: RadioChannelMode | undefined): boolean {
  return isDigitalMode(mode) || mode === 'fixed-analog';
}

function powerWireFromPercent(p: number | null): number {
  if (p == null) return 3;
  if (p <= 30) return 0;
  if (p <= 55) return 1;
  if (p <= 80) return 2;
  return 3;
}

function powerPercentFromWire(bits: number): number | null {
  if (bits === 0) return 25;
  if (bits === 1) return 50;
  if (bits === 2) return 75;
  return 100;
}

function bandwidthFromWire(bits: number): 'FM' | 'NFM' {
  return bits === 0 ? 'NFM' : 'FM';
}

function bandwidthToWire(bandwidth: 'FM' | 'NFM'): number {
  return bandwidth === 'NFM' ? 0 : 1;
}

function duplexFromRxTx(rxHz: number, txHz: number): number {
  if (rxHz <= 0 || txHz <= 0 || rxHz === txHz) return 0;
  return txHz > rxHz ? 1 : 2;
}

function offsetHz(rxHz: number, txHz: number): number {
  if (rxHz <= 0 || txHz <= 0) return 0;
  return Math.abs(txHz - rxHz);
}

function decodeScanListId(wire: number): number | undefined {
  if (wire === WIRE_INDEX_NONE) return undefined;
  return wire + 1;
}

function encodeScanListWire(scanListId: number | undefined): number {
  if (scanListId == null) return WIRE_INDEX_NONE;
  return (scanListId - 1) & 0xff;
}

function decodeRxGroupIndex(wire: number): number | undefined {
  if (wire === WIRE_INDEX_NONE) return undefined;
  return wire + 1;
}

function encodeRxGroupWire(rxGroupIndex: number | undefined): number {
  if (rxGroupIndex == null) return WIRE_INDEX_NONE;
  return (rxGroupIndex - 1) & 0xff;
}

/** Firmware channel-apply: byte `0x17` >= this is no TX contact. `0x00000000` is slot 0. */
const TX_CONTACT_NONE_HIGH = 0x7f;
/**
 * No TX contact is written as slot 9999 (`0F 27 00 00`). The radio's boot check rejects a
 * contact word above its bound ("Program Error / Please Initialize The Radio!"), so
 * `FF FF FF FF` and `FF FF 00 00` brick the codeplug. 9999 is in range and an unused slot in
 * any real codeplug. The official CPS writes None as `00 00 00 00` (there is no wire none).
 * Stock clamps an unused slot to slot 0; MM9PDY firmware treats it as none. See #1380.
 */
export const TX_CONTACT_NONE_WIRE = 9999;

function decodeTxContactId(data: Uint8Array, mode: RadioChannelMode): number | undefined {
  if (!isDigitalMode(mode)) return undefined;
  if (data[0x17]! >= TX_CONTACT_NONE_HIGH) return undefined;
  const wire = (data[0x14]! | (data[0x15]! << 8) | (data[0x16]! << 16) | (data[0x17]! << 24)) >>> 0;
  if (wire === TX_CONTACT_NONE_WIRE) return undefined;
  return wire + 1;
}

function encodeTxContactWire(data: Uint8Array, txContactId: number | undefined): void {
  // 0x13 is not part of the contact word; the official CPS never writes it.
  data[0x13] = 0;
  // None is slot 9999, not FF FF FF FF: the boot check rejects a word above its bound (#1380).
  const wire = txContactId == null ? TX_CONTACT_NONE_WIRE : txContactId - 1;
  data[0x14] = wire & 0xff;
  data[0x15] = (wire >>> 8) & 0xff;
  data[0x16] = (wire >>> 16) & 0xff;
  data[0x17] = (wire >>> 24) & 0xff;
}

export function parseAtD890ChannelRecord(data: Uint8Array, slotIndex: number): RadioChannelDto {
  if (data.length < AT_D890_LIMITS.CHANNEL_RECORD_SIZE) {
    throw new RangeError('D890 channel record must be 0x80 bytes');
  }
  const rxHz = decodeBcdFrequencyHz(data.subarray(0, 4));
  if (rxHz === 0) {
    return {
      slotIndex,
      empty: true,
      wireName: '',
      rxHz: 0,
      txHz: 0,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: null,
      bandwidth: 'NFM',
    };
  }
  const offHz = decodeBcdFrequencyHz(data.subarray(4, 8));
  const b8 = data[8]!;
  const duplex = (b8 >> 6) & 0x3;
  const bandwidth = bandwidthFromWire((b8 >> 4) & 0x3);
  const powerPercent = powerPercentFromWire((b8 >> 2) & 0x3);
  const channelType = modeFromWire(b8 & 0x3);
  const b9 = data[9]!;
  const ctcssEncSel = (b9 >> 2) & 0x3;
  const ctcssDecSel = b9 & 0x3;
  const rxTone =
    ctcssDecSel === 2
      ? decodeToneFromDcsU16(data[0x0e]!, data[0x0f]!)
      : decodeToneFromCtcssIndex(data[0x0b]!);
  const txTone =
    ctcssEncSel === 2
      ? decodeToneFromDcsU16(data[0x0c]!, data[0x0d]!)
      : decodeToneFromCtcssIndex(data[0x0a]!);
  let txHz = rxHz;
  if (duplex === 1) txHz = rxHz + offHz;
  if (duplex === 2) txHz = Math.max(0, rxHz - offHz);
  const autoScan = ((data[0x34]! >> BYTE_34_AUTO_SCAN_BIT) & 1) === 1;
  const rxOnly = ((data[0x34]! >> BYTE_34_RX_ONLY_BIT) & 1) === 1;
  const txContactId = decodeTxContactId(data, channelType);
  return {
    slotIndex,
    empty: false,
    wireName: decodeWideCharName(data.subarray(0x44, 0x64)),
    rxHz,
    txHz,
    rxTone,
    txTone,
    powerPercent,
    bandwidth,
    mode: channelType,
    ...(txContactId != null ? { txContactId } : {}),
    ...(decodeRxGroupIndex(data[0x1c]!) != null
      ? { rxGroupIndex: decodeRxGroupIndex(data[0x1c]!) }
      : {}),
    ...(decodeScanListId(data[0x1b]!) != null ? { scanListId: decodeScanListId(data[0x1b]!) } : {}),
    scanAdd: autoScan,
    dmrRadioIdIndex: data[0x18]!,
    timeslot: ((data[0x21]! >> BYTE_21_TIMESLOT_BIT) & 1) === 1 ? 2 : 1,
    ...(isDigitalMode(channelType)
      ? {
          dmrOperatingMode:
            ((data[0x34]! >> BYTE_34_DMO_BIT) & 1) === 1 ? 'dmo-simplex' : 'repeater',
        }
      : {}),
    rxOnly,
    ...(data[0x20]! > 0 ? { colorCode: data[0x20] } : {}),
    aprsReceive: ((data[0x21]! >> BYTE_21_APRS_RX_BIT) & 1) === 1,
    aprsReportMode: data[0x35]! === 2 ? 'digital' : 'off',
    aprsDigitalPttMode: data[0x37]! === 1 ? 'on' : 'off',
    ...(data[0x35]! === 2 && data[0x38]! < 8 ? { aprsReportSlotIndex: data[0x38]! + 1 } : {}),
  };
}

/**
 * Write the modelled NXDN bytes. The RX group list is the channel's list or "none" (`0xff`): a zero
 * there selects list 0, and a used slot holds whatever its previous channel had. An absent rate or RAN leaves its byte (or bit) as it is; a fresh
 * slot starts as zeros, so an absent rate is NXDN48 (6.25 kHz). Bit fields use `setBit`.
 */
export function applyAtD890NxdnChannelBytes(
  data: Uint8Array,
  nxdn: RadioChannelNxdnDto,
  slotIndex: number,
): void {
  if (nxdn.txRan != null) assertAtD890NxdnRan(nxdn.txRan, 'TX RAN', slotIndex);
  if (nxdn.rxRan != null) assertAtD890NxdnRan(nxdn.rxRan, 'RX RAN', slotIndex);
  data[NXDN_BYTE_RX_GROUP] = nxdn.rxGroupIndex ?? 0xff;
  // PTT Call (`0x67` b7:4) gates the contact: on only with a call target, whose list slot is the
  // u16 at `0x6C`. Off, the radio calls group ID 0. Busy lock (b3:0) is left as it is. A previous
  // occupant's encryption key slot (`0x6A`) and status message number (`0x6E`) are cleared: Studio
  // models neither, and a stale key slot would make the channel come up encrypted.
  const target = nxdn.txTargetIndex;
  data[NXDN_BYTE_PTT_CALL] =
    (data[NXDN_BYTE_PTT_CALL]! & 0x0f) | ((target != null ? 1 : 0) << NXDN_PTT_CALL_SHIFT);
  data[NXDN_BYTE_TX_CONTACT] = (target ?? 0) & 0xff;
  data[NXDN_BYTE_TX_CONTACT + 1] = ((target ?? 0) >> 8) & 0xff;
  data[NXDN_BYTE_ENCRYPTION] = 0;
  data[NXDN_BYTE_STATUS] = 0;
  if (nxdn.rate != null) {
    data[NXDN_BYTE_RATE] = setBit(data[NXDN_BYTE_RATE]!, NXDN_RATE_BIT, nxdn.rate === 'nxdn96');
  }
  if (nxdn.txRan != null) data[NXDN_BYTE_TX_RAN] = nxdn.txRan;
  if (nxdn.rxRan != null) data[NXDN_BYTE_RX_RAN] = nxdn.rxRan;
}

/** NXDN fields of a combined `0x80` channel record. Separate from {@link parseAtD890ChannelRecord}. */
export function decodeAtD890ChannelNxdn(
  record: Uint8Array,
): Required<Pick<RadioChannelNxdnDto, 'rxRan' | 'txRan' | 'rate'>> {
  return {
    rxRan: record[NXDN_BYTE_RX_RAN]!,
    txRan: record[NXDN_BYTE_TX_RAN]!,
    rate: ((record[NXDN_BYTE_RATE]! >> NXDN_RATE_BIT) & 1) === 1 ? 'nxdn96' : 'nxdn48',
  };
}

export function encodeAtD890ChannelRecord(ch: RadioChannelDto, prior?: Uint8Array): Uint8Array {
  const data = new Uint8Array(AT_D890_LIMITS.CHANNEL_RECORD_SIZE);
  data.fill(0);
  if (ch.empty || ch.rxHz <= 0) {
    return data;
  }
  const carriedOver = prior != null && !channelPriorIsAbsent(prior);
  if (carriedOver) {
    copyPreservedChannelBytes(data, prior);
  }
  assertAtD890MrChannelFrequencies(ch);
  const rxHz = ch.rxHz;
  const txHz = ch.txHz > 0 ? ch.txHz : rxHz;
  data.set(encodeBcdFrequencyHz(rxHz), 0);
  const duplex = duplexFromRxTx(rxHz, txHz);
  data.set(encodeBcdFrequencyHz(duplex === 0 ? 0 : offsetHz(rxHz, txHz)), 4);
  const power = powerWireFromPercent(ch.powerPercent);
  const bw = bandwidthToWire(ch.bandwidth);
  data[8] =
    ((duplex & 0x3) << 6) |
    ((bw & 0x3) << 4) |
    ((power & 0x3) << 2) |
    (wireFromMode(ch.mode) & 0x3);

  let b9 = 0;
  const txDcs = ch.txTone.kind === 'dcs';
  const rxDcs = ch.rxTone.kind === 'dcs';
  b9 |= (txDcs ? 2 : ch.txTone.kind === 'ctcss' ? 1 : 0) << 2;
  b9 |= rxDcs ? 2 : ch.rxTone.kind === 'ctcss' ? 1 : 0;
  data[9] = b9;

  if (txDcs) {
    const enc = encodeDcsTone(ch.txTone);
    data[0x0c] = enc.low;
    data[0x0d] = enc.high;
    data[0x0a] = 0;
  } else if (ch.txTone.kind === 'ctcss') {
    data[0x0a] = ctcssIndexFromHz(ch.txTone.hz);
  } else {
    data[0x0a] = 0;
  }
  if (rxDcs) {
    const dec = encodeDcsTone(ch.rxTone);
    data[0x0e] = dec.low;
    data[0x0f] = dec.high;
    data[0x0b] = 0;
  } else if (ch.rxTone.kind === 'ctcss') {
    data[0x0b] = ctcssIndexFromHz(ch.rxTone.hz);
  } else {
    data[0x0b] = 0;
  }

  if (ch.colorCode != null) {
    const cc = ch.colorCode & 0xff;
    data[0x20] = cc;
    data[0x43] = cc;
  }

  encodeTxContactWire(data, ch.txContactId);
  data[0x18] = ch.dmrRadioIdIndex ?? 0;
  data[0x1b] = encodeScanListWire(ch.scanListId);
  data[0x1c] = encodeRxGroupWire(ch.rxGroupIndex);

  data[0x21] = setBit(data[0x21]!, BYTE_21_SMS_CONFIRM_BIT, true);
  if (ch.timeslot === 2) {
    data[0x21] = setBit(data[0x21]!, BYTE_21_TIMESLOT_BIT, true);
  } else if (ch.timeslot === 1) {
    data[0x21] = setBit(data[0x21]!, BYTE_21_TIMESLOT_BIT, false);
  }
  if (ch.dmrOperatingMode === 'repeater' || ch.dmrOperatingMode === 'dmo-simplex') {
    data[0x21] = data[0x21]! & ~BYTE_21_DCDM_MASK;
  }
  applyModelledByte34(data, ch);

  if (ch.aprsReceive != null) {
    data[0x21] = setBit(data[0x21]!, BYTE_21_APRS_RX_BIT, ch.aprsReceive);
  }
  if (ch.aprsReportMode != null) {
    data[0x35] = ch.aprsReportMode === 'digital' ? 2 : 0;
  }
  if (ch.aprsDigitalPttMode != null) {
    data[0x37] = ch.aprsDigitalPttMode === 'on' ? 1 : 0;
  }
  if (ch.aprsReportSlotIndex != null && ch.aprsReportMode === 'digital') {
    data[0x38] = Math.max(0, Math.min(7, ch.aprsReportSlotIndex - 1));
  }

  if (ch.nxdn) applyAtD890NxdnChannelBytes(data, ch.nxdn, ch.slotIndex);
  else if (ch.clearNxdnBytes) data.fill(0, NXDN_FIRST_BYTE, NXDN_LAST_BYTE + 1);

  data.set(encodeWideCharName(ch.wireName, 0x20), 0x44);
  return data;
}

export function decodeChannelsFromAtD890Cache(cache: AtD890DownloadCache): RadioChannelDto[] {
  const setData = getCacheBytes(cache, D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
  const occupied = listSetBits(setData);
  const out: RadioChannelDto[] = [];
  for (const idx of occupied) {
    if (idx >= AT_D890_LIMITS.MAX_CHANNELS) continue;
    const primary = getCacheBytes(
      cache,
      channelPrimaryAddress(idx),
      AT_D890_LIMITS.CHANNEL_CHUNK_SIZE,
    );
    const secondary = getCacheBytes(
      cache,
      channelSecondaryAddress(idx),
      AT_D890_LIMITS.CHANNEL_CHUNK_SIZE,
    );
    const combined = new Uint8Array(AT_D890_LIMITS.CHANNEL_RECORD_SIZE);
    combined.set(primary, 0);
    combined.set(secondary, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE);
    out.push(parseAtD890ChannelRecord(combined, idx + 1));
  }
  return out.sort((a, b) => a.slotIndex - b.slotIndex);
}

export function encodeChannelsIntoAtD890Image(
  image: MemoryMap,
  channels: readonly RadioChannelDto[],
): MemoryMap {
  const set = image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES).slice();
  clearBitmapBitsBelow(set, AT_D890_LIMITS.MAX_CHANNELS);

  const maxSlot = AT_D890_LIMITS.MAX_CHANNELS;
  const toWrite = channels.filter((ch) => {
    if (ch.empty || ch.rxHz <= 0) return false;
    const idx = ch.slotIndex - 1;
    return idx >= 0 && idx < maxSlot;
  });

  const priors = new Map<number, Uint8Array>();
  for (const ch of toWrite) {
    const idx = ch.slotIndex - 1;
    priors.set(idx, readCombinedChannelRecord(image, idx));
  }

  for (let idx = 0; idx < maxSlot; idx++) {
    const primary = channelPrimaryAddress(idx);
    image.fill(primary, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE, 0);
    image.fill(channelSecondaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE, 0);
  }

  for (const ch of toWrite) {
    const idx = ch.slotIndex - 1;
    setBitmapBit(set, idx, true);
    const encoded = encodeAtD890ChannelRecord(ch, priors.get(idx));
    image.set(channelPrimaryAddress(idx), encoded.subarray(0, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE));
    image.set(
      channelSecondaryAddress(idx),
      encoded.subarray(AT_D890_LIMITS.CHANNEL_CHUNK_SIZE, AT_D890_LIMITS.CHANNEL_RECORD_SIZE),
    );
  }

  image.set(D890_MAP.ChannelSet, set);
  return image;
}

export function syncChannelRegionsToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.ChannelSet, length: AT_D890_LIMITS.CHANNEL_SET_BYTES },
  ]);
  const set = image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
  for (const idx of listSetBits(set)) {
    const primary = channelPrimaryAddress(idx);
    putCacheBytes(cache, primary, image.get(primary, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE));
    putCacheBytes(
      cache,
      channelSecondaryAddress(idx),
      image.get(channelSecondaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    );
  }
}

export function encodeChannelsIntoAtD890Cache(
  cache: AtD890DownloadCache,
  channels: readonly RadioChannelDto[],
): AtD890DownloadCache {
  const image = cacheToMemoryMap(cache);
  encodeChannelsIntoAtD890Image(image, channels);
  syncChannelRegionsToCache(cache, image);
  return cache;
}

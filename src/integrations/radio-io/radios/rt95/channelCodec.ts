/**
 * RT95 32-byte channel record codec.
 * Cite: CHIRP anytone778uv.py MEM_FORMAT memory struct (facts only).
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto, RadioTone } from '../../radioChannelDto.ts';
import {
  RT95_BANDLIMIT_OFFSET,
  RT95_CHANNEL_COUNT,
  RT95_CHANNEL_RECORD_SIZE,
  RT95_CHANNEL_SPAN,
  RT95_NAME_LENGTH,
} from './constants.ts';
import { decodeBcdFreq, encodeBcdFreq } from './bcd.ts';
import { ctcssIndexToHz, hzToCtcssIndex } from './ctcssToneTable.ts';
import { dtcsCodeToWireIndex, dtcsWireIndexToCode } from './allDtcsCodes.ts';
import {
  isMemoryOccupied,
  isMemoryScanEnabled,
  syncOccupiedBitfield,
  syncScanBitfield,
} from './bitfield.ts';

const TXPOWER_LOW = 0;
const TXPOWER_MED = 1;
const TXPOWER_HIGH = 2;

const DUPLEX_NONE = 0;
const DUPLEX_PLUS = 1;
const DUPLEX_MINUS = 2;
const DUPLEX_SPLIT = 3;

const WIDTH_NFM = 0;
const WIDTH_FM = 2;

/** CHIRP bitwise MSB-first bit positions within each byte (bit 0 = LSB). */
const BIT_TXPOWER = 2;
const BIT_DUPLEX = 0;
const BIT_CHANNEL_WIDTH = 2;
const BIT_TX_OFF = 0;
const BIT_CTCSS_ENCODE_EN = 0;
const BIT_DTCS_ENCODE_EN = 1;
const BIT_CTCSS_DECODE_EN = 2;
const BIT_DTCS_DECODE_EN = 3;
const BIT_DTCS_INVERT = 1;
const BIT_DTCS_HIGHBIT = 0;
const BIT_TONE_SQUELCH_EN = 0;

function getBit(byte: number, bit: number): boolean {
  return ((byte >> bit) & 1) === 1;
}

function setBits(byte: number, bit: number, width: number, value: number): number {
  const mask = ((1 << width) - 1) << bit;
  return (byte & ~mask) | ((value << bit) & mask);
}

function getBits(byte: number, bit: number, width: number): number {
  return (byte >> bit) & ((1 << width) - 1);
}

function dtcsCodeToBits(code: number): { low: number; high: number } {
  const idx = dtcsCodeToWireIndex(code);
  if (idx == null) return { low: 0, high: 0 };
  return { low: idx & 0xff, high: (idx >> 8) & 1 };
}

function dtcsBitsToCode(low: number, high: number): number | null {
  return dtcsWireIndexToCode(high * 256 + low);
}

function decodeRadioToneFromCtcssIndex(index: number): RadioTone {
  const hz = ctcssIndexToHz(index);
  return hz != null ? { kind: 'ctcss', hz } : { kind: 'none' };
}

function decodeRadioToneFromDtcs(low: number, high: number, invert: boolean): RadioTone {
  const code = dtcsBitsToCode(low, high);
  return code != null ? { kind: 'dcs', code, polarity: invert ? 'I' : 'N' } : { kind: 'none' };
}

function powerPercentFromTxPower(txpower: number): number | null {
  if (txpower === TXPOWER_LOW) return 20;
  if (txpower === TXPOWER_MED) return 40;
  if (txpower === TXPOWER_HIGH) return 100;
  return null;
}

function txPowerFromPercent(powerPercent: number | null): number {
  if (powerPercent == null) return TXPOWER_HIGH;
  if (powerPercent <= 20) return TXPOWER_LOW;
  if (powerPercent <= 40) return TXPOWER_MED;
  return TXPOWER_HIGH;
}

function decodeName(raw: Uint8Array): string {
  let name = '';
  for (let i = 24; i < 24 + RT95_NAME_LENGTH; i++) {
    const c = raw[i]!;
    if (c === 0xff || c === 0x00) break;
    name += String.fromCharCode(c < 32 ? 32 : c);
  }
  return name.replace(/\s+$/, '');
}

function isRecordBlank(raw: Uint8Array): boolean {
  return raw.every((b) => b === 0xff);
}

export function decodeChannelRecord(
  raw: Uint8Array,
  slotIndex: number,
  image?: Uint8Array,
): RadioChannelDto {
  if (raw.length < RT95_CHANNEL_RECORD_SIZE) {
    throw new RangeError(`Channel record must be ${RT95_CHANNEL_RECORD_SIZE} bytes`);
  }

  const occupied = image != null ? isMemoryOccupied(image, slotIndex) : !isRecordBlank(raw);

  if (!occupied || isRecordBlank(raw)) {
    return {
      slotIndex,
      empty: true,
      wireName: '',
      rxHz: 0,
      txHz: 0,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: null,
      bandwidth: 'FM',
    };
  }

  const rxHz = decodeBcdFreq(raw.subarray(0, 4));
  const offsetHz = decodeBcdFreq(raw.subarray(4, 8));
  const txOff = getBit(raw[10]!, BIT_TX_OFF);
  const duplex = getBits(raw[9]!, BIT_DUPLEX, 2);
  const channelWidth = getBits(raw[10]!, BIT_CHANNEL_WIDTH, 2);
  const txpower = getBits(raw[9]!, BIT_TXPOWER, 2);

  let txHz = rxHz;
  if (!txOff) {
    if (duplex === DUPLEX_PLUS || duplex === DUPLEX_MINUS) {
      const delta = duplex === DUPLEX_PLUS ? offsetHz : -offsetHz;
      txHz = rxHz + delta;
    } else if (duplex === DUPLEX_SPLIT) {
      txHz = offsetHz > 0 ? offsetHz : rxHz;
    }
  }

  const ctcssEncEn = getBit(raw[11]!, BIT_CTCSS_ENCODE_EN);
  const ctcssDecEn = getBit(raw[11]!, BIT_CTCSS_DECODE_EN);
  const dtcsEncEn = getBit(raw[11]!, BIT_DTCS_ENCODE_EN);
  const dtcsDecEn = getBit(raw[11]!, BIT_DTCS_DECODE_EN);

  let txTone: RadioTone = { kind: 'none' };
  if (ctcssEncEn) {
    txTone = decodeRadioToneFromCtcssIndex(raw[13]!);
  } else if (dtcsEncEn) {
    txTone = decodeRadioToneFromDtcs(
      raw[16]!,
      getBit(raw[17]!, BIT_DTCS_HIGHBIT) ? 1 : 0,
      getBit(raw[17]!, BIT_DTCS_INVERT),
    );
  }

  let rxTone: RadioTone = { kind: 'none' };
  if (ctcssDecEn) {
    rxTone = decodeRadioToneFromCtcssIndex(raw[12]!);
  } else if (dtcsDecEn) {
    rxTone = decodeRadioToneFromDtcs(
      raw[14]!,
      getBit(raw[15]!, BIT_DTCS_HIGHBIT) ? 1 : 0,
      getBit(raw[15]!, BIT_DTCS_INVERT),
    );
  }

  const scanAdd = image != null ? isMemoryScanEnabled(image, slotIndex) : getBit(raw[20]!, 0);

  return {
    slotIndex,
    empty: false,
    wireName: decodeName(raw),
    rxHz,
    txHz,
    rxTone,
    txTone,
    powerPercent: powerPercentFromTxPower(txpower),
    bandwidth: channelWidth === WIDTH_NFM ? 'NFM' : 'FM',
    scanAdd,
    ...(txOff ? { rxOnly: true } : {}),
    ...(duplex === DUPLEX_SPLIT && offsetHz !== rxHz ? {} : {}),
  };
}

function applyToneEncode(raw: Uint8Array, tone: RadioTone, direction: 'rx' | 'tx'): void {
  if (!tone || tone.kind === 'none') return;

  if (tone.kind === 'ctcss') {
    const idx = hzToCtcssIndex(tone.hz);
    if (idx == null) return;
    if (direction === 'tx') {
      raw[11] = setBits(raw[11]!, BIT_CTCSS_ENCODE_EN, 1, 1);
      raw[13] = idx;
    } else {
      raw[11] = setBits(raw[11]!, BIT_CTCSS_DECODE_EN, 1, 1);
      raw[12] = idx;
      raw[20] = setBits(raw[20]!, BIT_TONE_SQUELCH_EN, 1, 1);
    }
    return;
  }

  const { low, high } = dtcsCodeToBits(tone.code);
  const invert = tone.polarity === 'I';
  if (direction === 'tx') {
    raw[11] = setBits(raw[11]!, BIT_DTCS_ENCODE_EN, 1, 1);
    raw[16] = low;
    raw[17] = setBits(raw[17]!, BIT_DTCS_INVERT, 1, invert ? 1 : 0);
    raw[17] = setBits(raw[17]!, BIT_DTCS_HIGHBIT, 1, high);
  } else {
    raw[11] = setBits(raw[11]!, BIT_DTCS_DECODE_EN, 1, 1);
    raw[14] = low;
    raw[15] = setBits(raw[15]!, BIT_DTCS_INVERT, 1, invert ? 1 : 0);
    raw[15] = setBits(raw[15]!, BIT_DTCS_HIGHBIT, 1, high);
    raw[20] = setBits(raw[20]!, BIT_TONE_SQUELCH_EN, 1, 1);
  }
}

export function encodeChannelRecord(dto: RadioChannelDto, prior?: Uint8Array): Uint8Array {
  const out = new Uint8Array(RT95_CHANNEL_RECORD_SIZE);
  if (dto.empty || dto.rxHz <= 0) {
    out.fill(0xff);
    return out;
  }

  if (prior && prior.length === RT95_CHANNEL_RECORD_SIZE && !isRecordBlank(prior)) {
    out.set(prior);
  } else {
    out.fill(0);
  }

  out.set(encodeBcdFreq(dto.rxHz), 0);

  const txOff = dto.rxOnly === true;
  let duplex = DUPLEX_NONE;
  let offsetHz = 0;

  if (!txOff) {
    const txHz = dto.txHz > 0 ? dto.txHz : dto.rxHz;
    if (txHz > dto.rxHz) {
      duplex = DUPLEX_PLUS;
      offsetHz = txHz - dto.rxHz;
    } else if (txHz < dto.rxHz) {
      duplex = DUPLEX_MINUS;
      offsetHz = dto.rxHz - txHz;
    }
  }

  out.set(encodeBcdFreq(offsetHz), 4);

  out[9] = setBits(out[9]!, BIT_TXPOWER, 2, txPowerFromPercent(dto.powerPercent));
  out[9] = setBits(out[9]!, BIT_DUPLEX, 2, duplex);

  const width = dto.bandwidth === 'NFM' ? WIDTH_NFM : WIDTH_FM;
  out[10] = setBits(out[10]!, BIT_CHANNEL_WIDTH, 2, width);
  out[10] = setBits(out[10]!, BIT_TX_OFF, 1, txOff ? 1 : 0);

  out[11] = out[11]! & 0xf0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[16] = 0;
  applyToneEncode(out, dto.txTone, 'tx');
  applyToneEncode(out, dto.rxTone, 'rx');

  const nameStr = (dto.wireName || '').trim().slice(0, RT95_NAME_LENGTH).padEnd(RT95_NAME_LENGTH, ' ');
  const nameBytes = new TextEncoder().encode(nameStr);
  for (let i = 0; i < RT95_NAME_LENGTH; i++) {
    out[24 + i] = nameBytes[i]!;
  }

  return out;
}

export function decodeChannelsFromImage(image: Uint8Array | MemoryMap): RadioChannelDto[] {
  const bytes = 'bytes' in image ? image.bytes : image;
  const channels: RadioChannelDto[] = [];
  for (let i = 0; i < RT95_CHANNEL_COUNT; i++) {
    const offset = i * RT95_CHANNEL_RECORD_SIZE;
    channels.push(
      decodeChannelRecord(bytes.subarray(offset, offset + RT95_CHANNEL_RECORD_SIZE), i + 1, bytes),
    );
  }
  return channels;
}

/** Clear full channel span, write DTOs, sync occupied (+ scan) bitfields. */
export function encodeChannelsIntoImage(
  image: Uint8Array | MemoryMap,
  channels: readonly RadioChannelDto[],
): void {
  const bytes = 'bytes' in image ? image.bytes : image;
  bytes.fill(0xff, 0, RT95_CHANNEL_SPAN);

  const occupied: number[] = [];
  const scanEnabled: number[] = [];

  for (const ch of channels) {
    if (ch.slotIndex < 1 || ch.slotIndex > RT95_CHANNEL_COUNT) continue;
    const offset = (ch.slotIndex - 1) * RT95_CHANNEL_RECORD_SIZE;
    if (ch.empty || ch.rxHz <= 0) continue;

    const prior = bytes.subarray(offset, offset + RT95_CHANNEL_RECORD_SIZE);
    const encoded = encodeChannelRecord(ch, prior);
    bytes.set(encoded, offset);
    occupied.push(ch.slotIndex);
    if (ch.scanAdd) {
      scanEnabled.push(ch.slotIndex);
    }
  }

  syncOccupiedBitfield(bytes, occupied);
  syncScanBitfield(bytes, scanEnabled);
}

export function readBandlimitFromImage(image: Uint8Array | MemoryMap): number {
  const bytes = 'bytes' in image ? image.bytes : image;
  return bytes[RT95_BANDLIMIT_OFFSET] ?? 0x01;
}

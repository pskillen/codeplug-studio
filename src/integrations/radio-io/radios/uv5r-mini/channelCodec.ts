/**
 * UV-5R Mini 32-byte channel record codec.
 * Cite: NeonPlug channelFormat.ts (MIT); tier-3 channel-record.md. CHIRP facts only.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto, RadioTone } from '../../radioChannelDto.ts';
import {
  UV5R_MINI_CHANNEL_COUNT,
  UV5R_MINI_CHANNEL_SIZE,
  UV5R_MINI_CHANNEL_SPAN,
  UV5R_MINI_FW_VER_OFFSET,
} from './constants.ts';

/** Standard DTCS codes used by UV-17Pro family (NeonPlug sorted list). */
const DTCS_CODES = Object.freeze(
  [
    23, 25, 26, 31, 32, 36, 43, 47, 51, 53, 54, 65, 71, 72, 73, 74, 114, 115, 116, 122, 125, 131,
    132, 134, 143, 145, 152, 155, 156, 162, 165, 172, 174, 205, 212, 223, 225, 226, 243, 244, 245,
    246, 251, 252, 255, 261, 263, 265, 266, 271, 274, 306, 311, 315, 325, 331, 332, 343, 346, 351,
    356, 364, 365, 371, 411, 412, 413, 423, 431, 432, 445, 446, 452, 454, 455, 462, 464, 465, 466,
    503, 506, 516, 523, 526, 532, 546, 565, 606, 612, 624, 627, 631, 632, 654, 662, 664, 703, 712,
    723, 731, 732, 734, 743, 754, 645,
  ].sort((a, b) => a - b),
);

export function decodeBcdFreq(bytes: Uint8Array): number {
  const digits: number[] = [];
  for (let i = 0; i < 4; i++) {
    digits.push(bytes[i]! & 0x0f, (bytes[i]! >> 4) & 0x0f);
  }
  let val = 0;
  let mult = 1;
  for (let i = 0; i < 8; i++) {
    val += digits[i]! * mult;
    mult *= 10;
  }
  return val * 10;
}

export function encodeBcdFreq(hz: number): Uint8Array {
  let val = Math.floor(hz / 10);
  const digits: number[] = [];
  for (let i = 0; i < 8; i++) {
    digits.push(val % 10);
    val = Math.floor(val / 10);
  }
  const out = new Uint8Array(4);
  for (let i = 0; i < 4; i++) {
    out[i] = (digits[i * 2 + 1]! << 4) | digits[i * 2]!;
  }
  return out;
}

export function decodeTone(bytes: Uint8Array): RadioTone {
  const val = bytes[0]! | (bytes[1]! << 8);
  if (val === 0 || val === 0xffff) return { kind: 'none' };
  if (val >= 0x258) return { kind: 'ctcss', hz: val / 10 };
  const idx = val > 0x69 ? val - 0x6a : val - 1;
  const code = DTCS_CODES[idx];
  return code != null ? { kind: 'dcs', code } : { kind: 'none' };
}

export function encodeTone(tone: RadioTone | null | undefined): Uint8Array {
  if (!tone || tone.kind === 'none') return new Uint8Array([0, 0]);
  if (tone.kind === 'ctcss') {
    const val = Math.round(tone.hz * 10) >>> 0;
    if (val <= 0xffff) return new Uint8Array([val & 0xff, (val >> 8) & 0xff]);
    return new Uint8Array([0, 0]);
  }
  const idx = DTCS_CODES.indexOf(tone.code);
  if (idx >= 0) {
    const wire = idx + 1;
    return new Uint8Array([wire & 0xff, (wire >> 8) & 0xff]);
  }
  return new Uint8Array([0, 0]);
}

function powerPercentToLowBits(powerPercent: number | null): number {
  if (powerPercent == null) return 0; // High
  return powerPercent <= 50 ? 1 : 0; // Low when ≤50% (20% ladder step)
}

function lowBitsToPowerPercent(lowBits: number): number {
  return (lowBits & 0x03) === 0 ? 100 : 20;
}

function decodeName(raw: Uint8Array): string {
  let name = '';
  for (let j = 20; j < 32; j++) {
    const c = raw[j]!;
    if (c === 0xff || c === 0x00) break;
    name += String.fromCharCode(c < 32 ? 32 : c);
  }
  return name.replace(/\s+$/, '');
}

export function decodeChannelRecord(raw: Uint8Array, slotIndex: number): RadioChannelDto {
  if (raw.length < UV5R_MINI_CHANNEL_SIZE) {
    throw new RangeError(`Channel record must be ${UV5R_MINI_CHANNEL_SIZE} bytes`);
  }
  const empty = raw[0] === 0xff;
  if (empty) {
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
  const txAllFF = raw[4] === 0xff && raw[5] === 0xff && raw[6] === 0xff && raw[7] === 0xff;
  const txAllZero = raw[4] === 0 && raw[5] === 0 && raw[6] === 0 && raw[7] === 0;
  const txFilled = !txAllFF && !txAllZero;
  const txHz = txFilled ? decodeBcdFreq(raw.subarray(4, 8)) : rxHz;
  const wideBit = (raw[15]! >> 6) & 1;
  return {
    slotIndex,
    empty: false,
    wireName: decodeName(raw),
    rxHz,
    txHz,
    rxTone: decodeTone(raw.subarray(8, 10)),
    txTone: decodeTone(raw.subarray(10, 12)),
    powerPercent: lowBitsToPowerPercent(raw[14]!),
    bandwidth: wideBit ? 'NFM' : 'FM',
  };
}

export function encodeChannelRecord(dto: RadioChannelDto): Uint8Array {
  const out = new Uint8Array(UV5R_MINI_CHANNEL_SIZE);
  if (dto.empty || dto.rxHz <= 0) {
    out.fill(0xff);
    return out;
  }
  out.fill(0);
  out.set(encodeBcdFreq(dto.rxHz), 0);
  const txHz = dto.txHz > 0 ? dto.txHz : dto.rxHz;
  out.set(encodeBcdFreq(txHz), 4);
  out.set(encodeTone(dto.rxTone), 8);
  out.set(encodeTone(dto.txTone), 10);
  out[12] = 1;
  out[13] = 0;
  const lowBits = powerPercentToLowBits(dto.powerPercent);
  out[14] = (out[14]! & 0xcc) | (lowBits & 3);
  const wideBit = dto.bandwidth === 'NFM' ? 1 : 0;
  out[15] = (out[15]! & 0x82) | (wideBit << 6);
  const nameStr = (dto.wireName || '').trim().slice(0, 12);
  const nameBytes = new TextEncoder().encode(nameStr);
  for (let i = 20; i < 32; i++) {
    out[i] = i - 20 < nameBytes.length ? nameBytes[i - 20]! : 0x00;
  }
  return out;
}

/** Decode all occupied + empty slots from a packed clone image. */
export function decodeChannelsFromImage(image: Uint8Array | MemoryMap): RadioChannelDto[] {
  const bytes = 'bytes' in image ? image.bytes : image;
  const channels: RadioChannelDto[] = [];
  const max = Math.min(
    UV5R_MINI_CHANNEL_COUNT,
    Math.floor(Math.min(bytes.length, UV5R_MINI_CHANNEL_SPAN) / UV5R_MINI_CHANNEL_SIZE),
  );
  for (let i = 0; i < max; i++) {
    const offset = i * UV5R_MINI_CHANNEL_SIZE;
    channels.push(
      decodeChannelRecord(bytes.subarray(offset, offset + UV5R_MINI_CHANNEL_SIZE), i + 1),
    );
  }
  return channels;
}

/** Write channel DTOs into image (mutates). Unlisted slots left unchanged. */
export function encodeChannelsIntoImage(
  image: Uint8Array | MemoryMap,
  channels: readonly RadioChannelDto[],
): void {
  const bytes = 'bytes' in image ? image.bytes : image;
  for (const dto of channels) {
    const index = dto.slotIndex - 1;
    if (index < 0 || index >= UV5R_MINI_CHANNEL_COUNT) {
      throw new RangeError(`Channel slotIndex ${dto.slotIndex} out of range`);
    }
    const offset = index * UV5R_MINI_CHANNEL_SIZE;
    if (offset + UV5R_MINI_CHANNEL_SIZE > bytes.length) {
      throw new RangeError('Channel offset exceeds image size');
    }
    bytes.set(encodeChannelRecord(dto), offset);
  }
}

/** Parse ASCII firmware string from packed image offset 0x1EF0. */
export function readFirmwareFromImage(image: Uint8Array | MemoryMap): string | undefined {
  const bytes = 'bytes' in image ? image.bytes : image;
  if (bytes.length <= UV5R_MINI_FW_VER_OFFSET) return undefined;
  const slice = bytes.subarray(UV5R_MINI_FW_VER_OFFSET);
  let end = 0;
  const maxLen = Math.min(24, slice.length);
  while (end < maxLen) {
    const b = slice[end]!;
    if (b === 0x00 || b === 0xff || b < 0x20 || b > 0x7e) break;
    end++;
  }
  const s = String.fromCharCode(...slice.subarray(0, end)).trim();
  return s || undefined;
}

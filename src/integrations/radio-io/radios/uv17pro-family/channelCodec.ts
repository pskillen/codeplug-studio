/**
 * UV-17Pro family 32-byte channel record codec.
 * Cite: NeonPlug channelFormat.ts; CHIRP baofeng_uv17Pro.py (facts only).
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto, RadioTone } from '../../radioChannelDto.ts';
import type { Uv17ProLayout } from './layout.ts';

/** Byte 15 bit 2 — CHIRP `scan`. */
export const UV17PRO_SCAN_BIT = 0x04;

/** Byte 15 bit 6 — inverted wide/NFM polarity vs classic UV-5R. */
export const UV17PRO_WIDE_BIT = 0x40;

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
  const reverse = val > 0x69;
  const idx = reverse ? val - 0x6a : val - 1;
  const code = DTCS_CODES[idx];
  return code != null ? { kind: 'dcs', code, polarity: reverse ? 'I' : 'N' } : { kind: 'none' };
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
    const wire = idx + 1 + (tone.polarity === 'I' ? 0x69 : 0);
    return new Uint8Array([wire & 0xff, (wire >> 8) & 0xff]);
  }
  return new Uint8Array([0, 0]);
}

function powerPercentToLowBits(powerPercent: number | null): number {
  if (powerPercent == null) return 0;
  return powerPercent <= 50 ? 1 : 0;
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

export function decodeChannelRecord(
  layout: Uv17ProLayout,
  raw: Uint8Array,
  slotIndex: number,
): RadioChannelDto {
  if (raw.length < layout.channelSize) {
    throw new RangeError(`Channel record must be ${layout.channelSize} bytes`);
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
  const wideBit = (raw[15]! & UV17PRO_WIDE_BIT) !== 0;
  const scanAdd = (raw[15]! & UV17PRO_SCAN_BIT) !== 0;
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
    scanAdd,
    ...(txAllFF ? { rxOnly: true } : {}),
  };
}

export function encodeChannelRecord(layout: Uv17ProLayout, dto: RadioChannelDto): Uint8Array {
  const out = new Uint8Array(layout.channelSize);
  if (dto.empty || dto.rxHz <= 0) {
    out.fill(0xff);
    return out;
  }
  out.fill(0);
  out.set(encodeBcdFreq(dto.rxHz), 0);
  if (dto.rxOnly) {
    out.fill(0xff, 4, 8);
  } else {
    const txHz = dto.txHz > 0 ? dto.txHz : dto.rxHz;
    out.set(encodeBcdFreq(txHz), 4);
  }
  out.set(encodeTone(dto.rxTone), 8);
  out.set(encodeTone(dto.txTone), 10);
  out[12] = 1;
  out[13] = 0;
  const lowBits = powerPercentToLowBits(dto.powerPercent);
  out[14] = (out[14]! & 0xcc) | (lowBits & 3);
  const wideBit = dto.bandwidth === 'NFM' ? UV17PRO_WIDE_BIT : 0;
  const scanBit = dto.scanAdd ? UV17PRO_SCAN_BIT : 0;
  out[15] = wideBit | scanBit;
  const nameStr = (dto.wireName || '').trim().slice(0, 12);
  const nameBytes = new TextEncoder().encode(nameStr);
  for (let i = 20; i < 32; i++) {
    out[i] = i - 20 < nameBytes.length ? nameBytes[i - 20]! : 0x00;
  }
  return out;
}

/**
 * Record bytes Studio does not model, decoded for reference (`+0x0C..+0x13` and the spare bits of `+0x0E`
 * and `+0x0F`). Field names follow CHIRP `baofeng_uv17Pro.py`. Write keeps them only for a channel that is
 * unchanged since the Read (see {@link encodeChannelRecordOverPrior}); nothing in the library sets them.
 */
export interface Uv17ProChannelExtras {
  /** `+0x0C`: DTMF signal code (CHIRP `scode`). */
  signalCode: number;
  /** `+0x0D`: PTT ID mode (CHIRP `pttid`). */
  pttId: number;
  /** `+0x0E` bits 5–4: voice scramble (CHIRP `scramble`). */
  scramble: number;
  /** `+0x0E` bits 7–6 and 3–2: unnamed in CHIRP. */
  powerSpareBits: number;
  /** `+0x0F` bits 5–4: CHIRP `sqmode`, shown as "RX DTMF" (unmute on DTMF plus CTCSS/DCS). */
  rxDtmf: number;
  /** `+0x0F` bit 3: busy channel lockout (CHIRP `bcl`). */
  busyLockout: boolean;
  /** `+0x0F` bit 0: frequency hopping (CHIRP `fhss`). */
  fhss: boolean;
  /** `+0x0F` bits 7 and 1: unnamed in CHIRP. */
  flagSpareBits: number;
  /** `+0x10..+0x13`: unnamed in CHIRP. */
  reserved: Uint8Array;
}

export function decodeChannelExtras(raw: Uint8Array): Uv17ProChannelExtras {
  if (raw.length < 0x14) throw new RangeError('Channel record must reach +0x13');
  const flags = raw[15]!;
  return {
    signalCode: raw[12]!,
    pttId: raw[13]!,
    scramble: (raw[14]! >> 4) & 0x03,
    powerSpareBits: raw[14]! & 0xcc,
    rxDtmf: (flags >> 4) & 0x03,
    busyLockout: (flags & 0x08) !== 0,
    fhss: (flags & 0x01) !== 0,
    flagSpareBits: flags & 0x82,
    reserved: raw.slice(16, 20),
  };
}

function sameTone(a: RadioTone, b: RadioTone): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'ctcss' && b.kind === 'ctcss') return a.hz === b.hz;
  if (a.kind === 'dcs' && b.kind === 'dcs') {
    return a.code === b.code && (a.polarity ?? 'N') === (b.polarity ?? 'N');
  }
  return true;
}

/** Whether two decoded records agree on every field Studio models. */
function sameModelledFields(a: RadioChannelDto, b: RadioChannelDto): boolean {
  return (
    a.rxHz === b.rxHz &&
    a.txHz === b.txHz &&
    Boolean(a.rxOnly) === Boolean(b.rxOnly) &&
    sameTone(a.rxTone, b.rxTone) &&
    sameTone(a.txTone, b.txTone) &&
    a.powerPercent === b.powerPercent &&
    a.bandwidth === b.bandwidth &&
    Boolean(a.scanAdd) === Boolean(b.scanAdd) &&
    a.wireName === b.wireName
  );
}

/**
 * Encode `dto` over the slot's prior record, whole record at a time.
 *
 * - `dto` empty: `0xFF × 32`, unless the prior slot was already empty, when its bytes are kept as read.
 * - Prior slot live and every modelled field of `dto` (RX, TX / RX only, both tones, power, bandwidth, scan,
 *   name) decodes the same as the prior: the prior 32 bytes, exactly as read.
 * - Otherwise (prior empty, a different channel in the slot, or any edit): today's encoding
 *   ({@link encodeChannelRecord}), with the unmodelled fields at its defaults. A moved or edited channel never
 *   inherits the prior's PTT ID, RX DTMF, BCL, FHSS, scramble, signal code or reserved bytes.
 */
export function encodeChannelRecordOverPrior(
  layout: Uv17ProLayout,
  dto: RadioChannelDto,
  prior: Uint8Array | null | undefined,
): Uint8Array {
  const fresh = encodeChannelRecord(layout, dto);
  if (!prior || prior.length < layout.channelSize) return fresh;
  const priorEmpty = prior[0] === 0xff;
  const freshEmpty = fresh[0] === 0xff;
  if (freshEmpty) return priorEmpty ? prior.slice(0, layout.channelSize) : fresh;
  if (priorEmpty) return fresh;

  const want = decodeChannelRecord(layout, fresh, dto.slotIndex);
  const have = decodeChannelRecord(layout, prior, dto.slotIndex);
  return sameModelledFields(have, want) ? prior.slice(0, layout.channelSize) : fresh;
}

export function decodeChannelsFromImage(
  layout: Uv17ProLayout,
  image: Uint8Array | MemoryMap,
): RadioChannelDto[] {
  const bytes = 'bytes' in image ? image.bytes : image;
  const channels: RadioChannelDto[] = [];
  const max = Math.min(
    layout.channelCount,
    Math.floor(Math.min(bytes.length, layout.channelSpan) / layout.channelSize),
  );
  for (let i = 0; i < max; i++) {
    const offset = i * layout.channelSize;
    channels.push(
      decodeChannelRecord(layout, bytes.subarray(offset, offset + layout.channelSize), i + 1),
    );
  }
  return channels;
}

/**
 * Write channel DTOs into image (mutates). The image holds the prior Read on entry.
 *
 * Every slot in the channel span is rewritten: listed slots via {@link encodeChannelRecordOverPrior},
 * unlisted slots become empty (`0xFF × 32`, or the prior bytes when the slot was already empty).
 * With an unchanged library the span comes out byte for byte as read.
 */
export function encodeChannelsIntoImage(
  layout: Uv17ProLayout,
  image: Uint8Array | MemoryMap,
  channels: readonly RadioChannelDto[],
): void {
  const bytes = 'bytes' in image ? image.bytes : image;
  const span = Math.min(bytes.length, layout.channelSpan);
  const prior = bytes.slice(0, span);
  const fwSlice =
    layout.fwVerOffset != null && layout.fwVerLen != null && bytes.length > layout.fwVerOffset
      ? bytes.subarray(layout.fwVerOffset, layout.fwVerOffset + layout.fwVerLen).slice()
      : null;
  bytes.fill(0xff, 0, span);
  for (let offset = 0; offset + layout.channelSize <= span; offset += layout.channelSize) {
    if (prior[offset] === 0xff)
      bytes.set(prior.subarray(offset, offset + layout.channelSize), offset);
  }
  if (fwSlice) {
    bytes.set(fwSlice, layout.fwVerOffset!);
  }
  for (const dto of channels) {
    const index = dto.slotIndex - 1;
    if (index < 0 || index >= layout.channelCount) {
      throw new RangeError(`Channel slotIndex ${dto.slotIndex} out of range`);
    }
    const offset = index * layout.channelSize;
    if (offset + layout.channelSize > bytes.length) {
      throw new RangeError('Channel offset exceeds image size');
    }
    const priorRecord =
      offset + layout.channelSize <= span
        ? prior.subarray(offset, offset + layout.channelSize)
        : null;
    bytes.set(encodeChannelRecordOverPrior(layout, dto, priorRecord), offset);
  }
}

export function readFirmwareFromImage(
  layout: Uv17ProLayout,
  image: Uint8Array | MemoryMap,
): string | undefined {
  const bytes = 'bytes' in image ? image.bytes : image;
  if (layout.fwVerOffset == null || layout.fwVerLen == null) return undefined;
  if (bytes.length <= layout.fwVerOffset) return undefined;
  const slice = bytes.subarray(layout.fwVerOffset);
  let end = 0;
  const maxLen = Math.min(layout.fwVerLen, slice.length);
  while (end < maxLen) {
    const b = slice[end]!;
    if (b === 0x00 || b === 0xff || b < 0x20 || b > 0x7e) break;
    end++;
  }
  const s = String.fromCharCode(...slice.subarray(0, end)).trim();
  return s || undefined;
}

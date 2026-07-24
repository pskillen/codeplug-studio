/**
 * OpenGD77 / OpenUV380 0x38 channel record encode/decode + bank packing.
 * Cite: docs/reference/radios/opengd77/channel-record.md;
 * qdmr OpenGD77BaseCodeplug::ChannelElement (facts only; GPL-3).
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto, RadioChannelMode, RadioTone } from '../../radioChannelDto.ts';
import {
  OPENGD77_1701_POWER_STEPS,
  OPENGD77_CHANNEL_BANKS,
  OPENGD77_CHANNEL_BANK_BITMAP,
  OPENGD77_CHANNEL_BANK_RECORDS,
  OPENGD77_CHANNEL_NAME_LEN,
  OPENGD77_CHANNEL_RECORD_SIZE,
  OPENGD77_CHANNEL_SLOTS,
  OPENGD77_CHANNELS_PER_BANK,
  openUv380AbsToOffset,
  openUv380ChannelBankAbs,
} from './constants.ts';
import { readAbs, writeAbs } from './memory.ts';

const TE = new TextEncoder();

/** BCD8 little-endian → integer (qdmr getBCD8_le). */
export function decodeBcd8Le(bytes: Uint8Array): number {
  if (bytes.length < 4) return 0;
  const val = bytes[0]! | (bytes[1]! << 8) | (bytes[2]! << 16) | (bytes[3]! << 24);
  return (
    (val & 0xf) +
    ((val >> 4) & 0xf) * 10 +
    ((val >> 8) & 0xf) * 100 +
    ((val >> 12) & 0xf) * 1000 +
    ((val >> 16) & 0xf) * 10_000 +
    ((val >> 20) & 0xf) * 100_000 +
    ((val >> 24) & 0xf) * 1_000_000 +
    ((val >> 28) & 0xf) * 10_000_000
  );
}

/** Integer → BCD8 little-endian (qdmr setBCD8_le). */
export function encodeBcd8Le(value: number): Uint8Array {
  const v = Math.max(0, Math.floor(value)) >>> 0;
  const a = Math.floor(v / 10_000_000) % 10;
  const b = Math.floor(v / 1_000_000) % 10;
  const c = Math.floor(v / 100_000) % 10;
  const d = Math.floor(v / 10_000) % 10;
  const e = Math.floor(v / 1000) % 10;
  const f = Math.floor(v / 100) % 10;
  const g = Math.floor(v / 10) % 10;
  const h = v % 10;
  const packed =
    (a << 28) + (b << 24) + (c << 20) + (d << 16) + (e << 12) + (f << 8) + (g << 4) + h;
  return new Uint8Array([
    packed & 0xff,
    (packed >>> 8) & 0xff,
    (packed >>> 16) & 0xff,
    (packed >>> 24) & 0xff,
  ]);
}

/** Frequency Hz ↔ BCD8 LE × 10 Hz. */
export function decodeBcdFreqHz(bytes: Uint8Array): number {
  return decodeBcd8Le(bytes) * 10;
}

export function encodeBcdFreqHz(hz: number): Uint8Array {
  return encodeBcd8Le(Math.floor(hz / 10));
}

/**
 * Selective call u16 LE — qdmr encodeSelectiveCall / decodeSelectiveCall.
 * Bit15 = DCS, bit14 = inverted, low 14 bits = BCD tone/code.
 */
export function decodeSelectiveCall(code: number): RadioTone {
  if (code === 0xffff) return { kind: 'none' };
  const dcs = ((code >> 15) & 1) === 1;
  const inverted = ((code >> 14) & 1) === 1;
  const bcd = code & 0x3fff;
  const value =
    1000 * ((bcd >> 12) & 0xf) +
    100 * ((bcd >> 8) & 0xf) +
    10 * ((bcd >> 4) & 0xf) +
    (bcd & 0xf);
  if (!dcs) {
    if (value === 0) return { kind: 'none' };
    return { kind: 'ctcss', hz: value / 10 };
  }
  return { kind: 'dcs', code: value, polarity: inverted ? 'I' : 'N' };
}

export function encodeSelectiveCall(tone: RadioTone | null | undefined): number {
  if (!tone || tone.kind === 'none') return 0xffff;
  let dcs = 0;
  let inverted = 0;
  let toneCode = 0;
  if (tone.kind === 'dcs') {
    dcs = 1;
    inverted = tone.polarity === 'I' ? 1 : 0;
    toneCode = tone.code;
  } else {
    toneCode = Math.round(tone.hz * 10);
  }
  const bcd =
    (((Math.floor(toneCode / 1000) % 10) << 12) |
      ((Math.floor(toneCode / 100) % 10) << 8) |
      ((Math.floor(toneCode / 10) % 10) << 4) |
      (toneCode % 10)) &
    0x3fff;
  return ((dcs << 15) | (inverted << 14) | bcd) & 0xffff;
}

export function powerPercentToWire(percent: number | null): number {
  if (percent == null) return 0;
  let best = OPENGD77_1701_POWER_STEPS[0]!;
  let bestDist = Math.abs(percent - best.percent);
  for (const step of OPENGD77_1701_POWER_STEPS) {
    const dist = Math.abs(percent - step.percent);
    if (dist < bestDist) {
      best = step;
      bestDist = dist;
    }
  }
  return best.wire;
}

export function powerWireToPercent(wire: number): number | null {
  if (wire === 0) return null;
  const step = OPENGD77_1701_POWER_STEPS.find((s) => s.wire === wire);
  if (step) return step.percent;
  // Clamp unknown 1…10 to nearest known step.
  if (wire >= 10) return 100;
  if (wire < 1) return null;
  return OPENGD77_1701_POWER_STEPS[Math.min(wire, 9) - 1]?.percent ?? null;
}

function decodeName(raw: Uint8Array): string {
  let name = '';
  for (let i = 0; i < Math.min(OPENGD77_CHANNEL_NAME_LEN, raw.length); i++) {
    const c = raw[i]!;
    if (c === 0xff || c === 0x00) break;
    name += String.fromCharCode(c < 32 ? 32 : c);
  }
  return name.replace(/\s+$/, '');
}

function encodeName(name: string): Uint8Array {
  const out = new Uint8Array(OPENGD77_CHANNEL_NAME_LEN);
  out.fill(0xff);
  const bytes = TE.encode((name || '').trim().slice(0, OPENGD77_CHANNEL_NAME_LEN));
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i]!;
  }
  return out;
}

function modeFromWire(n: number): RadioChannelMode {
  return n === 1 ? 'digital' : 'analog';
}

function wireFromMode(mode: RadioChannelMode | undefined): number {
  return mode === 'digital' || mode === 'fixed-digital' ? 1 : 0;
}

function getU16Le(buf: Uint8Array, offset: number): number {
  return (buf[offset]! | (buf[offset + 1]! << 8)) & 0xffff;
}

function setU16Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
}

/** Decode one 0x38 channel record. `slotIndex` is 1-based. */
export function decodeChannelRecord(raw: Uint8Array, slotIndex: number): RadioChannelDto {
  if (raw.length < OPENGD77_CHANNEL_RECORD_SIZE) {
    throw new RangeError(`Channel record must be ${OPENGD77_CHANNEL_RECORD_SIZE} bytes`);
  }
  // Empty: name all 0xff or rx freq all 0xff.
  const nameEmpty = raw[0] === 0xff && raw[1] === 0xff;
  const freqEmpty = raw[0x10] === 0xff && raw[0x11] === 0xff && raw[0x12] === 0xff;
  if (nameEmpty || freqEmpty) {
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

  const rxHz = decodeBcdFreqHz(raw.subarray(0x10, 0x14));
  const txHz = decodeBcdFreqHz(raw.subarray(0x14, 0x18));
  const bits33 = raw[0x33]!;
  const groupListWire = raw[0x2b]!;
  const txContactWire = getU16Le(raw, 0x2e);
  const timeslotBit = (raw[0x31]! >> 6) & 1;

  return {
    slotIndex,
    empty: false,
    wireName: decodeName(raw.subarray(0, OPENGD77_CHANNEL_NAME_LEN)),
    rxHz,
    txHz: txHz > 0 ? txHz : rxHz,
    rxTone: decodeSelectiveCall(getU16Le(raw, 0x20)),
    txTone: decodeSelectiveCall(getU16Le(raw, 0x22)),
    powerPercent: powerWireToPercent(raw[0x19]!),
    bandwidth: (bits33 & 0x02) !== 0 ? 'FM' : 'NFM',
    mode: modeFromWire(raw[0x18]!),
    colorCode: raw[0x2c]!,
    timeslot: timeslotBit === 1 ? 2 : 1,
    txContactId: txContactWire > 0 ? txContactWire : undefined,
    rxGroupIndex: groupListWire > 0 ? groupListWire - 1 : undefined,
    skipScan: (bits33 & 0x10) !== 0,
    skipZoneScan: (bits33 & 0x20) !== 0,
    rxOnly: (bits33 & 0x04) !== 0,
  };
}

/** Encode one 0x38 channel record. */
export function encodeChannelRecord(dto: RadioChannelDto): Uint8Array {
  const out = new Uint8Array(OPENGD77_CHANNEL_RECORD_SIZE);
  if (dto.empty || dto.rxHz <= 0) {
    out.fill(0xff);
    return out;
  }
  out.fill(0x00);
  out.set(encodeName(dto.wireName), 0);
  out.set(encodeBcdFreqHz(dto.rxHz), 0x10);
  out.set(encodeBcdFreqHz(dto.txHz > 0 ? dto.txHz : dto.rxHz), 0x14);
  out[0x18] = wireFromMode(dto.mode);
  out[0x19] = powerPercentToWire(dto.powerPercent);
  // latitude / timeout / longitude left 0 (not modelled on write)
  setU16Le(out, 0x20, encodeSelectiveCall(dto.rxTone));
  setU16Le(out, 0x22, encodeSelectiveCall(dto.txTone));
  out[0x26] = 0; // flags — simplex etc. not modelled
  // dmrId @ 0x27 left 0
  out[0x2b] =
    dto.rxGroupIndex != null && dto.rxGroupIndex >= 0 ? (dto.rxGroupIndex + 1) & 0xff : 0;
  out[0x2c] = (dto.colorCode ?? 0) & 0xff;
  out[0x2d] = 0; // aprsIndex clear
  setU16Le(out, 0x2e, dto.txContactId != null && dto.txContactId > 0 ? dto.txContactId : 0);
  out[0x30] = 0; // alias none
  out[0x31] = dto.timeslot === 2 ? 0x40 : 0x00;
  let bits33 = 0;
  if (dto.bandwidth === 'FM') bits33 |= 0x02;
  if (dto.rxOnly) bits33 |= 0x04;
  if (dto.skipScan) bits33 |= 0x10;
  if (dto.skipZoneScan) bits33 |= 0x20;
  out[0x33] = bits33;
  out[0x37] = 0; // squelch global
  return out;
}

function bankBitEnabled(bank: Uint8Array, indexInBank: number): boolean {
  const byte = OPENGD77_CHANNEL_BANK_BITMAP + Math.floor(indexInBank / 8);
  const bit = indexInBank % 8;
  return ((bank[byte]! >> bit) & 1) === 1;
}

function setBankBit(bank: Uint8Array, indexInBank: number, enabled: boolean): void {
  const byte = OPENGD77_CHANNEL_BANK_BITMAP + Math.floor(indexInBank / 8);
  const bit = indexInBank % 8;
  if (enabled) {
    bank[byte] = bank[byte]! | (1 << bit);
  } else {
    bank[byte] = bank[byte]! & ~(1 << bit);
  }
}

function recordOffsetInBank(indexInBank: number): number {
  return OPENGD77_CHANNEL_BANK_RECORDS + indexInBank * OPENGD77_CHANNEL_RECORD_SIZE;
}

function emptySlot(slotIndex: number): RadioChannelDto {
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

/** Decode all channel slots from an OpenUV380 MemoryMap. */
export function decodeChannelsFromImage(image: MemoryMap): RadioChannelDto[] {
  const channels: RadioChannelDto[] = [];
  for (let bank = 0; bank < OPENGD77_CHANNEL_BANKS; bank++) {
    const bankAbs = openUv380ChannelBankAbs(bank);
    let bankBytes: Uint8Array;
    try {
      bankBytes = readAbs(image, bankAbs, 0x1c10);
    } catch {
      for (let i = 0; i < OPENGD77_CHANNELS_PER_BANK; i++) {
        channels.push(emptySlot(bank * OPENGD77_CHANNELS_PER_BANK + i + 1));
      }
      continue;
    }
    for (let i = 0; i < OPENGD77_CHANNELS_PER_BANK; i++) {
      const slotIndex = bank * OPENGD77_CHANNELS_PER_BANK + i + 1;
      if (!bankBitEnabled(bankBytes, i)) {
        channels.push(emptySlot(slotIndex));
        continue;
      }
      const off = recordOffsetInBank(i);
      channels.push(
        decodeChannelRecord(
          bankBytes.subarray(off, off + OPENGD77_CHANNEL_RECORD_SIZE),
          slotIndex,
        ),
      );
    }
  }
  return channels;
}

/**
 * Encode channel DTOs into image banks (mutates). Unlisted occupied slots are
 * cleared when `clearUnlisted` is true (default): write replaces the channel table.
 */
export function encodeChannelsIntoImage(
  image: MemoryMap,
  channels: readonly RadioChannelDto[],
  opts?: { clearUnlisted?: boolean },
): void {
  const clearUnlisted = opts?.clearUnlisted !== false;
  const bySlot = new Map<number, RadioChannelDto>();
  for (const dto of channels) {
    if (dto.slotIndex < 1 || dto.slotIndex > OPENGD77_CHANNEL_SLOTS) {
      throw new RangeError(`Channel slotIndex ${dto.slotIndex} out of range`);
    }
    bySlot.set(dto.slotIndex, dto);
  }

  for (let bank = 0; bank < OPENGD77_CHANNEL_BANKS; bank++) {
    const bankAbs = openUv380ChannelBankAbs(bank);
    const bankBytes = readAbs(image, bankAbs, 0x1c10);
    for (let i = 0; i < OPENGD77_CHANNELS_PER_BANK; i++) {
      const slotIndex = bank * OPENGD77_CHANNELS_PER_BANK + i + 1;
      const dto = bySlot.get(slotIndex);
      const off = recordOffsetInBank(i);
      if (dto == null) {
        if (clearUnlisted) {
          setBankBit(bankBytes, i, false);
          bankBytes.fill(0xff, off, off + OPENGD77_CHANNEL_RECORD_SIZE);
        }
        continue;
      }
      if (dto.empty || dto.rxHz <= 0) {
        setBankBit(bankBytes, i, false);
        bankBytes.fill(0xff, off, off + OPENGD77_CHANNEL_RECORD_SIZE);
      } else {
        setBankBit(bankBytes, i, true);
        bankBytes.set(encodeChannelRecord(dto), off);
      }
    }
    writeAbs(image, bankAbs, bankBytes);
  }
}

/** Occupied channel count (bitmap + non-empty decode). */
export function countOccupiedChannels(image: MemoryMap): number {
  return decodeChannelsFromImage(image).filter((c) => !c.empty).length;
}

/** Map MemoryMap offset helper exported for tests. */
export function channelRecordAbs(slotIndex1Based: number): number {
  const index0 = slotIndex1Based - 1;
  const bank = Math.floor(index0 / OPENGD77_CHANNELS_PER_BANK);
  const inBank = index0 % OPENGD77_CHANNELS_PER_BANK;
  return openUv380ChannelBankAbs(bank) + recordOffsetInBank(inBank);
}

export function channelRecordMapOffset(slotIndex1Based: number): number {
  return openUv380AbsToOffset(channelRecordAbs(slotIndex1Based));
}

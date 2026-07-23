/**
 * DM-32UV 48-byte channel record encode/decode + bank packing.
 * Cite: NeonPlug structures.ts parseChannel/encodeChannel; tier-3 channel-record.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto, RadioChannelMode, RadioTone } from '../../radioChannelDto.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_CHANNEL_RECORD_SIZE,
  DM32_LIMITS,
  DM32_METADATA,
  DM32_METADATA_OFFSET,
  DM32_OFFSET,
} from './constants.ts';

export interface Dm32ChannelDecodeContext {
  addressBase: number;
  discovered: readonly { address: number; metadata: number }[];
}

const TD = new TextDecoder('ascii', { fatal: false });
const TE = new TextEncoder();

/** NeonPlug BCD: freq MHz as float → Studio uses Hz integers. */
export function decodeBcdFrequencyHz(data: Uint8Array): number {
  if (data.length < 4) return 0;
  const bcd = [data[3]!, data[2]!, data[1]!, data[0]!];
  let freqInt = 0;
  for (let i = 0; i < 4; i++) {
    const high = (bcd[i]! >> 4) & 0x0f;
    const low = bcd[i]! & 0x0f;
    freqInt = freqInt * 100 + high * 10 + low;
  }
  // NeonPlug returns MHz float (freqInt / 100000); convert to Hz.
  return Math.round((freqInt / 100_000) * 1_000_000);
}

export function encodeBcdFrequencyHz(hz: number): Uint8Array {
  const mhz = hz / 1_000_000;
  const freqInt = Math.round(mhz * 100_000);
  const bcd: number[] = [];
  let temp = freqInt;
  for (let i = 3; i >= 0; i--) {
    const low = temp % 10;
    temp = Math.floor(temp / 10);
    const high = temp % 10;
    temp = Math.floor(temp / 10);
    bcd[i] = (high << 4) | low;
  }
  return new Uint8Array([bcd[3]!, bcd[2]!, bcd[1]!, bcd[0]!]);
}

function decodeTone(data: Uint8Array): RadioTone {
  if (data.length < 2) return { kind: 'none' };
  const low = data[0]!;
  const high = data[1]!;
  if ((low === 0xff && high === 0xff) || (low === 0 && high === 0)) return { kind: 'none' };
  if (high >= 0x80) {
    const code = (high & 0x0f) * 100 + ((low >> 4) & 0x0f) * 10 + (low & 0x0f);
    return { kind: 'dcs', code, polarity: high >= 0xc0 ? 'I' : 'N' };
  }
  const hundreds = (high >> 4) & 0x0f;
  const tens = high & 0x0f;
  const ones = (low >> 4) & 0x0f;
  const decimalPart = low & 0x0f;
  const hz = hundreds * 100 + tens * 10 + ones + decimalPart / 10;
  if (hz === 0) return { kind: 'none' };
  return { kind: 'ctcss', hz };
}

function encodeTone(tone: RadioTone): Uint8Array {
  if (tone.kind === 'none') return new Uint8Array([0x00, 0x00]);
  if (tone.kind === 'dcs') {
    const code = tone.code;
    const hundreds = Math.floor(code / 100) % 10;
    const tens = Math.floor((code % 100) / 10);
    const ones = code % 10;
    const base = tone.polarity === 'I' ? 0xc0 : 0x80;
    return new Uint8Array([(tens << 4) | ones, base | hundreds]);
  }
  const integerPart = Math.floor(tone.hz);
  const hundreds = Math.floor(integerPart / 100);
  const tens = Math.floor((integerPart % 100) / 10);
  const ones = integerPart % 10;
  const decimalPart = Math.round((tone.hz - integerPart) * 10);
  return new Uint8Array([(ones << 4) | decimalPart, (hundreds << 4) | tens]);
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

function powerPercentFromWire(bits: number): number {
  if (bits === 0) return 20;
  if (bits === 1) return 50;
  return 100;
}

function powerWireFromPercent(p: number | null): number {
  if (p == null) return 2;
  if (p <= 30) return 0;
  if (p <= 60) return 1;
  return 2;
}

export function parseDm32ChannelRecord(data: Uint8Array, slotIndex: number): RadioChannelDto {
  if (data.length < DM32_CHANNEL_RECORD_SIZE) {
    throw new RangeError('DM-32 channel record must be 48 bytes');
  }
  if (data.every((b) => b === 0xff)) {
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

  const nameBytes = data.subarray(0, 16);
  const nullIndex = nameBytes.indexOf(0);
  const wireName = TD.decode(nameBytes.subarray(0, nullIndex >= 0 ? nullIndex : 16))
    .replace(/\0/g, '')
    .trim();

  const rxHz = decodeBcdFrequencyHz(data.subarray(0x10, 0x14));
  const txBytes = data.subarray(0x14, 0x18);
  const txHz = txBytes.every((b) => b === 0xff) ? rxHz : decodeBcdFrequencyHz(txBytes);

  const modeFlags = data[0x18]!;
  const mode = modeFromWire((modeFlags >> 4) & 0x0f);
  const powerPercent = powerPercentFromWire((modeFlags >> 1) & 0x03);

  const scanBw = data[0x19]!;
  const bandwidth: 'FM' | 'NFM' = (scanBw & 0x80) !== 0 ? 'FM' : 'NFM';

  const digitalFlags = data[0x1d]!;
  const colorCode = digitalFlags & 0x0f;
  const timeslot: 1 | 2 = (digitalFlags & 0x10) !== 0 ? 2 : 1;
  const rxGroupIndex = data[0x1f]! & 0x3f;

  const empty = !wireName && rxHz <= 0;

  return {
    slotIndex,
    empty,
    wireName,
    rxHz,
    txHz,
    rxTone: decodeTone(data.subarray(0x21, 0x23)),
    txTone: decodeTone(data.subarray(0x23, 0x25)),
    powerPercent,
    bandwidth,
    mode,
    colorCode,
    timeslot,
    rxGroupIndex,
  };
}

export function encodeDm32ChannelRecord(ch: RadioChannelDto): Uint8Array {
  const data = new Uint8Array(DM32_CHANNEL_RECORD_SIZE);
  data.fill(0xff);
  if (ch.empty) return data;

  const name = TE.encode(ch.wireName.slice(0, 16));
  data.fill(0, 0, 16);
  data.set(name, 0);

  data.set(encodeBcdFrequencyHz(ch.rxHz), 0x10);
  data.set(encodeBcdFrequencyHz(ch.txHz || ch.rxHz), 0x14);

  let modeFlags = (wireFromMode(ch.mode) & 0x0f) << 4;
  modeFlags |= (powerWireFromPercent(ch.powerPercent) & 0x03) << 1;
  data[0x18] = modeFlags;

  const scanBw =
    (ch.bandwidth === 'FM' ? 0x80 : 0x00) |
    (ch.scanAdd ? 0x40 : 0x00) |
    (((ch.scanListId ?? 0) & 0x0f) << 2);
  data[0x19] = scanBw;

  let digital = (ch.colorCode ?? 1) & 0x0f;
  if (ch.timeslot === 2) digital |= 0x10;
  data[0x1d] = digital;
  data[0x1f] = (ch.rxGroupIndex ?? 0) & 0x3f;

  data.set(encodeTone(ch.rxTone), 0x21);
  data.set(encodeTone(ch.txTone), 0x23);
  return data;
}

function findBlockByMetadata(
  _image: MemoryMap,
  addressBase: number,
  metadata: number,
  discovered: readonly { address: number; metadata: number }[],
): { address: number; offset: number } | null {
  const hit = discovered.find((b) => b.metadata === metadata);
  if (!hit) return null;
  return { address: hit.address, offset: hit.address - addressBase };
}

function readTxContactId(
  image: MemoryMap,
  addressBase: number,
  discovered: readonly { address: number; metadata: number }[],
  slotIndex: number,
): number | undefined {
  const entrySize = 2;
  if (slotIndex <= 2048) {
    const block = findBlockByMetadata(image, addressBase, DM32_METADATA.TX_CONTACT_LOW, discovered);
    if (!block) return undefined;
    const off = block.offset + (slotIndex - 1) * entrySize;
    const b0 = image.bytes[off];
    const b1 = image.bytes[off + 1];
    if (b0 === undefined || b1 === undefined) return undefined;
    const id = b0 | ((b1 & 0x7f) << 8);
    return id === 0 || id === 0xffff ? undefined : id;
  }
  const block = findBlockByMetadata(image, addressBase, DM32_METADATA.TX_CONTACT_HIGH, discovered);
  if (!block) return undefined;
  const off = block.offset + (slotIndex - 2049) * entrySize;
  const b0 = image.bytes[off];
  const b1 = image.bytes[off + 1];
  if (b0 === undefined || b1 === undefined) return undefined;
  const id = b0 | ((b1 & 0x7f) << 8);
  return id === 0 || id === 0xffff ? undefined : id;
}

function channelOffsetInBank(slotIndex: number): { blockIndex: number; offsetInBlock: number } {
  const first = DM32_LIMITS.CHANNELS_IN_FIRST_BLOCK;
  const later = DM32_LIMITS.CHANNELS_PER_LATER_BLOCK;
  if (slotIndex <= first) {
    return {
      blockIndex: 0,
      offsetInBlock: DM32_OFFSET.FIRST_CHANNEL + (slotIndex - 1) * DM32_CHANNEL_RECORD_SIZE,
    };
  }
  const remaining = slotIndex - first;
  const blockIndex = 1 + Math.floor((remaining - 1) / later);
  const indexInBlock = (remaining - 1) % later;
  return { blockIndex, offsetInBlock: indexInBlock * DM32_CHANNEL_RECORD_SIZE };
}

export function decodeChannelsFromDm32Image(
  image: MemoryMap,
  cache: Dm32ChannelDecodeContext,
): RadioChannelDto[] {
  const channelBlocks = cache.discovered
    .filter(
      (b) => b.metadata >= DM32_METADATA.CHANNEL_FIRST && b.metadata <= DM32_METADATA.CHANNEL_LAST,
    )
    .sort((a, b) => a.metadata - b.metadata);
  if (channelBlocks.length === 0) return [];

  const first = channelBlocks[0]!;
  const firstOff = first.address - cache.addressBase;
  const count = image.bytes[firstOff]! | (image.bytes[firstOff + 1]! << 8);
  const max = Math.min(count, DM32_LIMITS.CHANNEL_MAX);
  const out: RadioChannelDto[] = [];

  for (let slot = 1; slot <= max; slot++) {
    const { blockIndex, offsetInBlock } = channelOffsetInBank(slot);
    const block = channelBlocks[blockIndex];
    if (!block) break;
    const base = block.address - cache.addressBase;
    const record = image.get(base + offsetInBlock, DM32_CHANNEL_RECORD_SIZE);
    const dto = parseDm32ChannelRecord(record, slot);
    const txContactId = readTxContactId(image, cache.addressBase, cache.discovered, slot);
    if (txContactId !== undefined) dto.txContactId = txContactId;
    out.push(dto);
  }
  return out;
}

export function encodeChannelsIntoDm32Image(
  image: MemoryMap,
  cache: Dm32ChannelDecodeContext,
  channels: readonly RadioChannelDto[],
): MemoryMap {
  const channelBlocks = cache.discovered
    .filter(
      (b) => b.metadata >= DM32_METADATA.CHANNEL_FIRST && b.metadata <= DM32_METADATA.CHANNEL_LAST,
    )
    .sort((a, b) => a.metadata - b.metadata);
  if (channelBlocks.length === 0) return image;

  const bySlot = new Map(channels.filter((c) => !c.empty).map((c) => [c.slotIndex, c]));
  const maxSlot = Math.max(0, ...bySlot.keys());
  const firstOff = channelBlocks[0]!.address - cache.addressBase;
  image.bytes[firstOff] = maxSlot & 0xff;
  image.bytes[firstOff + 1] = (maxSlot >>> 8) & 0xff;

  for (const [slot, ch] of bySlot) {
    const { blockIndex, offsetInBlock } = channelOffsetInBank(slot);
    const block = channelBlocks[blockIndex];
    if (!block) continue;
    const base = block.address - cache.addressBase;
    image.set(base + offsetInBlock, encodeDm32ChannelRecord(ch));

    // TX contact
    const entrySize = 2;
    if (ch.txContactId != null && ch.txContactId > 0) {
      const id = ch.txContactId & 0x7fff;
      const lo = id & 0xff;
      const hi = (id >>> 8) & 0x7f;
      if (slot <= 2048) {
        const tx = findBlockByMetadata(
          image,
          cache.addressBase,
          DM32_METADATA.TX_CONTACT_LOW,
          cache.discovered,
        );
        if (tx) {
          const off = tx.offset + (slot - 1) * entrySize;
          image.bytes[off] = lo;
          image.bytes[off + 1] = hi;
        }
      } else {
        const tx = findBlockByMetadata(
          image,
          cache.addressBase,
          DM32_METADATA.TX_CONTACT_HIGH,
          cache.discovered,
        );
        if (tx) {
          const off = tx.offset + (slot - 2049) * entrySize;
          image.bytes[off] = lo;
          image.bytes[off + 1] = hi;
        }
      }
    }
  }

  // Preserve metadata bytes on channel blocks
  for (const block of channelBlocks) {
    const off = block.address - cache.addressBase + DM32_METADATA_OFFSET;
    if (off >= 0 && off < image.size) {
      image.bytes[off] = block.metadata;
    }
  }
  void DM32_BLOCK_SIZE;
  return image;
}

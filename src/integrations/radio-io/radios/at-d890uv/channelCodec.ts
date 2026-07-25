/**
 * AT-D890UV 0x80 channel record encode/decode.
 * Cite: anytone-cps `Channel::encode_D890UV` / `decode_D890UV` (facts only).
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto, RadioChannelMode, RadioTone } from '../../radioChannelDto.ts';
import { decodeBcdFrequencyHz, encodeBcdFrequencyHz } from './bcd.ts';
import { clearBitmap, listSetBits, setBitmapBit } from './bitmap.ts';
import {
  AT_D890_LIMITS,
  D890_MAP,
} from './constants.ts';
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

function decodeToneFromDcsU16(low: number, high: number): RadioTone {
  if (low === 0 && high === 0) return { kind: 'none' };
  const code = (high & 0x0f) * 100 + ((low >> 4) & 0x0f) * 10 + (low & 0x0f);
  if (code === 0) return { kind: 'none' };
  return { kind: 'dcs', code, polarity: high >= 0xc0 ? 'I' : 'N' };
}

function decodeToneFromCtcssIndex(index: number): RadioTone {
  if (index === 0) return { kind: 'none' };
  // Index table not modelled — surface as none; full tone tables are a fidelity follow-up.
  return { kind: 'none' };
}

function encodeDcsTone(tone: RadioTone): { low: number; high: number } {
  if (tone.kind !== 'dcs') return { low: 0, high: 0 };
  const hundreds = Math.floor(tone.code / 100) % 10;
  const tens = Math.floor((tone.code % 100) / 10);
  const ones = tone.code % 10;
  const base = tone.polarity === 'I' ? 0xc0 : 0x80;
  return { low: (tens << 4) | ones, high: base | hundreds };
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

function duplexFromRxTx(rxHz: number, txHz: number): number {
  if (rxHz <= 0 || txHz <= 0 || rxHz === txHz) return 0;
  return txHz > rxHz ? 1 : 2;
}

function offsetHz(rxHz: number, txHz: number): number {
  if (rxHz <= 0 || txHz <= 0) return 0;
  return Math.abs(txHz - rxHz);
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
      bandwidth: 'FM',
    };
  }
  const offHz = decodeBcdFrequencyHz(data.subarray(4, 8));
  const b8 = data[8]!;
  const duplex = (b8 >> 6) & 0x3;
  const bandwidth = ((b8 >> 4) & 0x3) === 0 ? 'FM' : 'NFM';
  const powerPercent = powerPercentFromWire((b8 >> 2) & 0x3);
  const channelType = modeFromWire(b8 & 0x3);
  const b9 = data[9]!;
  const rxOnly = ((b9 >> 5) & 1) === 1;
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
  const contactIdx = (data[0x13]! << 8) | data[0x14]!;
  let txHz = rxHz;
  if (duplex === 1) txHz = rxHz + offHz;
  if (duplex === 2) txHz = Math.max(0, rxHz - offHz);
  const autoScan = ((data[0x34]! >> 4) & 1) === 1;
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
    txContactId: contactIdx > 0 ? contactIdx : undefined,
    rxGroupIndex: data[0x1c]!,
    scanListId: data[0x1b]! > 0 ? data[0x1b] : undefined,
    scanAdd: autoScan,
    dmrRadioIdIndex: data[0x18]!,
    timeslot: ((data[0x21]! >> 1) & 1) === 1 ? 2 : 1,
    rxOnly,
  };
}

export function encodeAtD890ChannelRecord(ch: RadioChannelDto): Uint8Array {
  const data = new Uint8Array(AT_D890_LIMITS.CHANNEL_RECORD_SIZE);
  data.fill(0);
  if (ch.empty || ch.rxHz <= 0) {
    return data;
  }
  const rxHz = ch.rxHz;
  const txHz = ch.txHz > 0 ? ch.txHz : rxHz;
  data.set(encodeBcdFrequencyHz(rxHz), 0);
  const duplex = duplexFromRxTx(rxHz, txHz);
  data.set(encodeBcdFrequencyHz(offsetHz(rxHz, txHz)), 4);
  const power = powerWireFromPercent(ch.powerPercent);
  const bw = ch.bandwidth === 'NFM' ? 1 : 0;
  data[8] = ((duplex & 0x3) << 6) | ((bw & 0x3) << 4) | ((power & 0x3) << 2) | (wireFromMode(ch.mode) & 0x3);

  let b9 = 0;
  if (ch.rxOnly) b9 |= 1 << 5;
  const txDcs = ch.txTone.kind === 'dcs';
  const rxDcs = ch.rxTone.kind === 'dcs';
  b9 |= (txDcs ? 2 : ch.txTone.kind === 'ctcss' ? 1 : 0) << 2;
  b9 |= rxDcs ? 2 : ch.rxTone.kind === 'ctcss' ? 1 : 0;
  data[9] = b9;

  if (txDcs) {
    const enc = encodeDcsTone(ch.txTone);
    data[0x0c] = enc.low;
    data[0x0d] = enc.high;
  }
  if (rxDcs) {
    const dec = encodeDcsTone(ch.rxTone);
    data[0x0e] = dec.low;
    data[0x0f] = dec.high;
  }

  const contact = ch.txContactId ?? 0;
  data[0x13] = (contact >> 8) & 0xff;
  data[0x14] = contact & 0xff;
  data[0x18] = ch.dmrRadioIdIndex ?? 0;
  data[0x1b] = ch.scanListId ?? 0;
  data[0x1c] = ch.rxGroupIndex ?? 0;
  if (ch.timeslot === 2) data[0x21] |= 1 << 1;
  if (ch.scanAdd) data[0x34] |= 1 << 4;

  data.set(encodeWideCharName(ch.wireName, 0x20), 0x44);
  return data;
}

export function decodeChannelsFromAtD890Cache(cache: AtD890DownloadCache): RadioChannelDto[] {
  const setData = getCacheBytes(cache, D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
  const occupied = listSetBits(setData);
  const out: RadioChannelDto[] = [];
  for (const idx of occupied) {
    const primary = getCacheBytes(cache, channelPrimaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE);
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
  clearBitmap(set);

  const maxSlot = AT_D890_LIMITS.MAX_CHANNELS;
  for (let idx = 0; idx < maxSlot; idx++) {
    const primary = channelPrimaryAddress(idx);
    image.fill(primary, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE, 0);
    image.fill(channelSecondaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE, 0);
  }

  for (const ch of channels) {
    if (ch.empty || ch.rxHz <= 0) continue;
    const idx = ch.slotIndex - 1;
    if (idx < 0 || idx >= maxSlot) continue;
    setBitmapBit(set, idx, true);
    const encoded = encodeAtD890ChannelRecord(ch);
    image.set(channelPrimaryAddress(idx), encoded.subarray(0, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE));
    image.set(
      channelSecondaryAddress(idx),
      encoded.subarray(AT_D890_LIMITS.CHANNEL_CHUNK_SIZE, AT_D890_LIMITS.CHANNEL_RECORD_SIZE),
    );
  }

  image.set(D890_MAP.ChannelSet, set);
  return image;
}

export function syncChannelRegionsToCache(
  cache: AtD890DownloadCache,
  image: MemoryMap,
): void {
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

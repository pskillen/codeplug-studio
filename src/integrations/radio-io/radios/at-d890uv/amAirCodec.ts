/**
 * AT-D890UV AmAir channel bank encode/decode.
 * Record: BCD freq @ +0x0 (4) + UTF-16LE name @ +0x4 (0x20); remainder zero.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioAmAirChannelDto } from '../../radioWriteProjection.ts';
import { clearBitmap, listSetBits, setBitmapBit } from './bitmap.ts';
import { encodeBcdFrequencyHz, decodeBcdFrequencyHz } from './bcd.ts';
import { D890_MAP } from './constants.ts';
import {
  amAirDataAddress,
  getCacheBytes,
  mergeMapRegionsIntoCache,
  putCacheBytes,
  type AtD890DownloadCache,
} from './memory.ts';
import { decodeWideCharName, encodeWideCharName } from './wideChar.ts';
import { toAtD890ChannelIndex } from './channelIndex.ts';

const NAME_OFFSET = 0x4;
const NAME_BYTES = 0x20;

export function encodeAmAirRecord(channel: RadioAmAirChannelDto): Uint8Array {
  const buf = new Uint8Array(D890_MAP.AmAirDataLength);
  buf.fill(0);
  buf.set(encodeBcdFrequencyHz(channel.rxHz), 0);
  buf.set(encodeWideCharName(channel.wireName, NAME_BYTES), NAME_OFFSET);
  return buf;
}

export function decodeAmAirRecord(data: Uint8Array): { rxHz: number; wireName: string } {
  const rxHz = decodeBcdFrequencyHz(data.subarray(0, 4));
  const wireName = decodeWideCharName(data.subarray(NAME_OFFSET, NAME_OFFSET + NAME_BYTES));
  return { rxHz, wireName };
}

/**
 * Replace the AmAir programmable bank from projection (VFO left untouched).
 * `slotIndex` is 1-based; wire occupancy uses 0-based indices.
 */
export function encodeAmAirIntoAtD890Image(
  image: MemoryMap,
  channels: readonly RadioAmAirChannelDto[],
): MemoryMap {
  const set = image.get(D890_MAP.AmAirSet, D890_MAP.AmAirSetLength).slice();
  clearBitmap(set);

  for (let i = 0; i < D890_MAP.AmAirCount; i++) {
    image.fill(amAirDataAddress(i), D890_MAP.AmAirDataLength, 0);
  }

  for (const channel of channels) {
    const idx = toAtD890ChannelIndex(channel.slotIndex);
    if (idx < 0 || idx >= D890_MAP.AmAirCount) continue;
    setBitmapBit(set, idx, true);
    image.set(amAirDataAddress(idx), encodeAmAirRecord(channel));
  }

  image.set(D890_MAP.AmAirSet, set);
  return image;
}

export function syncAmAirRegionsToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.AmAirSet, length: D890_MAP.AmAirSetLength },
  ]);
  const set = image.get(D890_MAP.AmAirSet, D890_MAP.AmAirSetLength);
  for (const idx of listSetBits(set)) {
    putCacheBytes(
      cache,
      amAirDataAddress(idx),
      image.get(amAirDataAddress(idx), D890_MAP.AmAirDataLength),
    );
  }
}

export function decodeAmAirFromAtD890Cache(cache: AtD890DownloadCache): RadioAmAirChannelDto[] {
  const set = getCacheBytes(cache, D890_MAP.AmAirSet, D890_MAP.AmAirSetLength);
  const out: RadioAmAirChannelDto[] = [];
  for (const idx of listSetBits(set)) {
    const raw = getCacheBytes(cache, amAirDataAddress(idx), D890_MAP.AmAirDataLength);
    const decoded = decodeAmAirRecord(raw);
    out.push({
      slotIndex: idx + 1,
      wireName: decoded.wireName,
      rxHz: decoded.rxHz,
    });
  }
  return out;
}

/**
 * AT-D890UV receive-group encode.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioRxGroupDto } from '../../radioWriteProjection.ts';
import { clearBitmap, setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import {
  mergeMapRegionsIntoCache,
  putCacheBytes,
  receiveGroupAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { encodeWideCharName } from './wideChar.ts';

function writeU32Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

export function encodeAtD890RxGroupRecord(rx: RadioRxGroupDto): Uint8Array {
  const body = new Uint8Array(0x100);
  body.fill(0xff);
  // memberDigitalIds are 0-based talkgroup bank slot indices (not DMR IDs).
  const count = Math.min(rx.memberDigitalIds.length, 32);
  for (let i = 0; i < count; i++) {
    writeU32Le(body, i * 4, rx.memberDigitalIds[i]!);
  }
  const name = encodeWideCharName(rx.wireName, 0x20);
  const out = new Uint8Array(0x120);
  out.fill(0xff);
  out.set(body, 0);
  out.set(name, 0x100);
  return out;
}

export function encodeRxGroupsIntoAtD890Image(
  image: MemoryMap,
  rxGroups: readonly RadioRxGroupDto[],
): MemoryMap {
  const set = image.get(D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES).slice();
  clearBitmap(set);
  const max = set.length * 8;
  for (let i = 0; i < max; i++) {
    image.fill(receiveGroupAddress(i), AT_D890_LIMITS.RX_GROUP_STRIDE, 0xff);
  }
  for (const rx of rxGroups) {
    if (rx.memberDigitalIds.length === 0) continue;
    const idx = rx.index - 1;
    if (idx < 0) continue;
    setBitmapBit(set, idx, true);
    image.set(receiveGroupAddress(idx), encodeAtD890RxGroupRecord(rx));
  }
  image.set(D890_MAP.ReceiveGroupSet, set);
  return image;
}

export function syncRxGroupRegionsToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.ReceiveGroupSet, length: AT_D890_LIMITS.RX_GROUP_SET_BYTES },
  ]);
  const set = image.get(D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES);
  for (let idx = 0; idx < set.length * 8; idx++) {
    const byte = Math.floor(idx / 8);
    const bit = idx % 8;
    if ((set[byte]! & (1 << bit)) === 0) continue;
    putCacheBytes(
      cache,
      receiveGroupAddress(idx),
      image.get(receiveGroupAddress(idx), AT_D890_LIMITS.RX_GROUP_STRIDE),
    );
  }
}

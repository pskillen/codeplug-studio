/**
 * AT-D890UV talkgroup encode — inverted TalkgroupSet + per-slot stride records.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioTalkGroupDto } from '../../radioWriteProjection.ts';
import { clearBitmap, setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { mergeMapRegionsIntoCache, putCacheBytes, talkgroupAddress, type AtD890DownloadCache } from './memory.ts';
import { encodeWideCharName } from './wideChar.ts';

const CALL_TYPE_GROUP = 0x04;

export function encodeAtD890TalkgroupRecord(tg: RadioTalkGroupDto): Uint8Array {
  const data = new Uint8Array(AT_D890_LIMITS.TALKGROUP_RECORD_SIZE);
  data.fill(0);
  data[0] = tg.callType || CALL_TYPE_GROUP;
  if (tg.wireName) {
    data.set(encodeWideCharName(tg.wireName, 0x20), 0x6);
  }
  const idHex = tg.digitalId.toString(16).padStart(8, '0');
  for (let i = 0; i < 4; i++) {
    data[0x2 + i] = Number.parseInt(idHex.slice(i * 2, i * 2 + 2), 16) & 0xff;
  }
  return data;
}

export function encodeTalkgroupsIntoAtD890Image(
  image: MemoryMap,
  talkGroups: readonly RadioTalkGroupDto[],
): MemoryMap {
  const set = image.get(D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES).slice();
  clearBitmap(set, true);
  const max = set.length * 8;
  for (let i = 0; i < max; i++) {
    image.fill(talkgroupAddress(i), AT_D890_LIMITS.TALKGROUP_STRIDE, 0);
  }
  for (const tg of talkGroups) {
    if (tg.digitalId <= 0) continue;
    const idx = tg.index - 1;
    if (idx < 0) continue;
    setBitmapBit(set, idx, true, true);
    image.set(talkgroupAddress(idx), encodeAtD890TalkgroupRecord(tg));
  }
  image.set(D890_MAP.TalkgroupSet, set);
  return image;
}

export function syncTalkgroupRegionsToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.TalkgroupSet, length: AT_D890_LIMITS.TALKGROUP_SET_BYTES },
  ]);
  const set = image.get(D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES);
  for (let idx = 0; idx < set.length * 8; idx++) {
    const byte = Math.floor(idx / 8);
    const bit = idx % 8;
    if ((set[byte]! & (1 << bit)) !== 0) continue;
    putCacheBytes(
      cache,
      talkgroupAddress(idx),
      image.get(talkgroupAddress(idx), AT_D890_LIMITS.TALKGROUP_STRIDE),
    );
  }
}

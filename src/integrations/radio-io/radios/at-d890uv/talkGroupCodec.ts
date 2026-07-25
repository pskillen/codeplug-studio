/**
 * AT-D890UV talkgroup encode — inverted TalkgroupSet + per-slot stride records.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioTalkGroupDto } from '../../radioWriteProjection.ts';
import { clearBitmap, setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import {
  mergeMapRegionsIntoCache,
  mergeImageRegionIntoCache,
  clearTalkgroupDataBlocksFromCache,
  talkgroupAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { encodeBcdAsHexU32 } from './bcd.ts';
import { encodeWideCharName } from './wideChar.ts';

/** Anytone D890 wire call type: Private=0, Group=1, All=2. */
const ANYTONE_CALL_TYPE_GROUP = 0x01;

/** NeonPlug quick-contact call types (DM-32 projection). */
const NEONPLUG_CALL_TYPE_PRIVATE = 0x03;
const NEONPLUG_CALL_TYPE_GROUP = 0x04;
const NEONPLUG_CALL_TYPE_ALL = 0x05;

function encodeAtD890TalkgroupCallType(callType: number | undefined): number {
  switch (callType) {
    case NEONPLUG_CALL_TYPE_PRIVATE:
      return 0;
    case NEONPLUG_CALL_TYPE_GROUP:
      return 1;
    case NEONPLUG_CALL_TYPE_ALL:
      return 2;
    case 0:
    case 1:
    case 2:
      return callType;
    default:
      return ANYTONE_CALL_TYPE_GROUP;
  }
}

export function encodeAtD890TalkgroupRecord(tg: RadioTalkGroupDto): Uint8Array {
  const data = new Uint8Array(AT_D890_LIMITS.TALKGROUP_RECORD_SIZE);
  data.fill(0);
  data[0] = encodeAtD890TalkgroupCallType(tg.callType);
  if (tg.wireName) {
    data.set(encodeWideCharName(tg.wireName, 0x20), 0x6);
  }
  data.set(encodeBcdAsHexU32(tg.digitalId), 0x2);
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
    image.fill(talkgroupAddress(i), AT_D890_LIMITS.TALKGROUP_RECORD_SIZE, 0);
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
  clearTalkgroupDataBlocksFromCache(cache);
  const set = image.get(D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES);
  for (let idx = 0; idx < set.length * 8; idx++) {
    const byte = Math.floor(idx / 8);
    const bit = idx % 8;
    if ((set[byte]! & (1 << bit)) !== 0) continue;
    mergeImageRegionIntoCache(
      cache,
      image,
      talkgroupAddress(idx),
      AT_D890_LIMITS.TALKGROUP_RECORD_SIZE,
    );
  }
}

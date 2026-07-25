/**
 * AT-D890UV operator radio ID bank encode.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioRadioIdDto } from '../../radioWriteProjection.ts';
import { clearBitmap, setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import {
  mergeMapRegionsIntoCache,
  putCacheBytes,
  radioIdAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { encodeWideCharName } from './wideChar.ts';

export function encodeAtD890RadioIdRecord(rid: RadioRadioIdDto): Uint8Array {
  const data = new Uint8Array(AT_D890_LIMITS.RADIO_ID_STRIDE);
  data.fill(0);
  const idHex = rid.dmrId.toString(16).padStart(8, '0');
  for (let i = 0; i < 4; i++) {
    data[i] = Number.parseInt(idHex.slice(i * 2, i * 2 + 2), 16) & 0xff;
  }
  data.set(encodeWideCharName(rid.name, 52), 4);
  return data;
}

export function encodeRadioIdsIntoAtD890Image(
  image: MemoryMap,
  radioIds: readonly RadioRadioIdDto[],
): MemoryMap {
  const set = image.get(D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES).slice();
  clearBitmap(set);
  const max = set.length * 8;
  for (let i = 0; i < max; i++) {
    image.fill(radioIdAddress(i), AT_D890_LIMITS.RADIO_ID_STRIDE, 0);
  }
  for (const rid of radioIds) {
    if (rid.dmrId <= 0) continue;
    setBitmapBit(set, rid.index, true);
    image.set(radioIdAddress(rid.index), encodeAtD890RadioIdRecord(rid));
  }
  image.set(D890_MAP.RadioIdSet, set);
  return image;
}

export function syncRadioIdRegionsToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.RadioIdSet, length: AT_D890_LIMITS.RADIO_ID_SET_BYTES },
  ]);
  const set = image.get(D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES);
  for (let idx = 0; idx < set.length * 8; idx++) {
    const byte = Math.floor(idx / 8);
    const bit = idx % 8;
    if ((set[byte]! & (1 << bit)) === 0) continue;
    putCacheBytes(
      cache,
      radioIdAddress(idx),
      image.get(radioIdAddress(idx), AT_D890_LIMITS.RADIO_ID_STRIDE),
    );
  }
}

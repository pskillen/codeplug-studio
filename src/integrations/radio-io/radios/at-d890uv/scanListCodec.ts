/**
 * AT-D890UV scan list encode.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioScanListDto } from '../../radioWriteProjection.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { AT_D890_SCAN_TIMING_DECISECONDS } from '@core/radios/anytone/at-d890uv/scanListWireDefaults.ts';
import { clearBitmapBitsBelow, setBitmapBit } from './bitmap.ts';
import { toAtD890ChannelIndex } from './channelIndex.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import {
  mergeMapRegionsIntoCache,
  putCacheBytes,
  scanListAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { encodeWideCharName } from './wideChar.ts';

function writeU16Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

/** Wire sentinel: priority channel Off / none (anytone-cps `0xffff`). */
const AT_D890_SCAN_PRIORITY_OFF = 0xffff;

/** Revert channel: Selected + TalkBack (official CPS default). */
const AT_D890_SCAN_REVERT_CHANNEL = 0x01;

/** Member array: `SCAN_LIST_MEMBERS_MAX` × u16 at `+0x30` through `+0xF7`. */
const AT_D890_SCAN_MEMBER_BYTES = AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX * 2;

export function encodeAtD890ScanListRecord(scan: RadioScanListDto): Uint8Array {
  const data = new Uint8Array(AT_D890_LIMITS.SCAN_LIST_RECORD_SIZE);
  data.fill(0);
  data[0x1] = 0;
  writeU16Le(data, 0x2, AT_D890_SCAN_PRIORITY_OFF);
  writeU16Le(data, 0x4, AT_D890_SCAN_PRIORITY_OFF);
  writeU16Le(data, 0x6, AT_D890_SCAN_TIMING_DECISECONDS);
  writeU16Le(data, 0x8, AT_D890_SCAN_TIMING_DECISECONDS);
  writeU16Le(data, 0xa, AT_D890_SCAN_TIMING_DECISECONDS);
  writeU16Le(data, 0xc, AT_D890_SCAN_TIMING_DECISECONDS);
  data.set(encodeWideCharName(scan.wireName, 0x20), 0xe);
  const members = new Uint8Array(AT_D890_SCAN_MEMBER_BYTES);
  members.fill(0xff);
  const count = Math.min(scan.channelNumbers.length, AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX);
  for (let i = 0; i < count; i++) {
    writeU16Le(members, i * 2, toAtD890ChannelIndex(scan.channelNumbers[i]!));
  }
  const combined = new Uint8Array(AT_D890_LIMITS.SCAN_LIST_RECORD_SIZE);
  combined.set(data, 0);
  combined.set(members, 0x30);
  combined[0xf8] = AT_D890_SCAN_REVERT_CHANNEL;
  combined[0xf9] = 0;
  return combined;
}

export function encodeScanListsIntoAtD890Image(
  image: MemoryMap,
  scanLists: readonly RadioScanListDto[],
): MemoryMap {
  const set = image.get(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES).slice();
  clearBitmapBitsBelow(set, AT_D890UV_LIMITS.SCAN_LISTS_MAX);
  const max = AT_D890UV_LIMITS.SCAN_LISTS_MAX;
  for (let i = 0; i < max; i++) {
    image.fill(scanListAddress(i), AT_D890_LIMITS.SCAN_LIST_STRIDE, 0xff);
  }
  for (const scan of scanLists) {
    const idx = scan.listIndex - 1;
    if (idx < 0) continue;
    if (scan.channelNumbers.length === 0) continue;
    setBitmapBit(set, idx, true);
    const record = encodeAtD890ScanListRecord(scan);
    image.set(scanListAddress(idx), record.subarray(0, AT_D890_LIMITS.SCAN_LIST_STRIDE));
  }
  image.set(D890_MAP.ScanListSet, set);
  return image;
}

export function syncScanListRegionsToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.ScanListSet, length: AT_D890_LIMITS.SCAN_LIST_SET_BYTES },
  ]);
  const set = image.get(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
  for (let idx = 0; idx < set.length * 8; idx++) {
    const byte = Math.floor(idx / 8);
    const bit = idx % 8;
    if ((set[byte]! & (1 << bit)) === 0) continue;
    putCacheBytes(
      cache,
      scanListAddress(idx),
      image.get(scanListAddress(idx), AT_D890_LIMITS.SCAN_LIST_STRIDE),
    );
  }
}

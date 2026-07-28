/**
 * AT-D890UV AmZone bank encode/decode.
 * Layout verified against hardware 2026-07-28 — do not port anytone-cps encode.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioAmZoneDto } from '../../radioWriteProjection.ts';
import { clearBitmap, listSetBits, setBitmapBit } from './bitmap.ts';
import { AT_D890_INVALID_U16, D890_MAP } from './constants.ts';
import {
  amZoneDataAddress,
  getCacheBytes,
  mergeMapRegionsIntoCache,
  putCacheBytes,
  type AtD890DownloadCache,
} from './memory.ts';
import { encodeWideCharName, decodeWideCharName } from './wideChar.ts';
import { toAtD890ChannelIndex } from './channelIndex.ts';

function writeU16Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

function readU16Le(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

export function encodeAmZoneRecord(zone: RadioAmZoneDto): Uint8Array {
  const buf = new Uint8Array(D890_MAP.AmZoneDataLength);
  buf.fill(0);
  buf.set(encodeWideCharName(zone.wireName, D890_MAP.AmZoneNameLength), D890_MAP.AmZoneNameOffset);

  const memberLimit = Math.min(zone.channelNumbers.length, D890_MAP.AmZoneMemberSlots);
  for (let i = 0; i < D890_MAP.AmZoneMemberSlots; i++) {
    const off = D890_MAP.AmZoneMembersOffset + i * 2;
    if (i < memberLimit) {
      writeU16Le(buf, off, toAtD890ChannelIndex(zone.channelNumbers[i]!));
    } else {
      writeU16Le(buf, off, AT_D890_INVALID_U16);
    }
  }
  // Reserved tail 0x62–0x7f: CPS writes zeros (purpose unknown).
  return buf;
}

export function decodeAmZoneRecord(data: Uint8Array): {
  wireName: string;
  channelIndices0: number[];
} {
  const wireName = decodeWideCharName(
    data.subarray(D890_MAP.AmZoneNameOffset, D890_MAP.AmZoneNameLength),
  );
  const channelIndices0: number[] = [];
  for (let i = 0; i < D890_MAP.AmZoneMemberSlots; i++) {
    const v = readU16Le(data, D890_MAP.AmZoneMembersOffset + i * 2);
    if (v === AT_D890_INVALID_U16) break;
    channelIndices0.push(v);
  }
  return { wireName, channelIndices0 };
}

function encodeAmZoneScanBits(
  memberCount: number,
  scanMemberIndices?: readonly number[],
): Uint8Array {
  const buf = new Uint8Array(D890_MAP.AmZoneScanStride);
  buf.fill(0);
  if (scanMemberIndices) {
    for (const pos of scanMemberIndices) {
      if (pos < 0 || pos >= D890_MAP.AmZoneMemberSlots) continue;
      setBitmapBit(buf, pos, true);
    }
    return buf;
  }
  // Default: all programmed members are scanned (matches every hardware sample).
  for (let pos = 0; pos < memberCount && pos < D890_MAP.AmZoneMemberSlots; pos++) {
    setBitmapBit(buf, pos, true);
  }
  return buf;
}

/**
 * Replace the AmZone bank from projection (zones + A-channel + scan bitmaps).
 */
export function encodeAmZonesIntoAtD890Image(
  image: MemoryMap,
  zones: readonly RadioAmZoneDto[],
): MemoryMap {
  const set = image.get(D890_MAP.AmZoneSet, D890_MAP.AmZoneSetLength).slice();
  const aChannel = image.get(D890_MAP.AmZoneAChannel, D890_MAP.AmZoneAChannelLength).slice();
  const scan = image.get(D890_MAP.AmZoneScan, D890_MAP.AmZoneScanLength).slice();
  clearBitmap(set);
  aChannel.fill(0);
  scan.fill(0);

  for (let i = 0; i < D890_MAP.AmZoneCount; i++) {
    image.fill(amZoneDataAddress(i), D890_MAP.AmZoneDataLength, 0);
  }

  zones.forEach((zone, zIdx) => {
    if (zIdx >= D890_MAP.AmZoneCount) return;
    if (zone.channelNumbers.length === 0) return;
    setBitmapBit(set, zIdx, true);
    image.set(amZoneDataAddress(zIdx), encodeAmZoneRecord(zone));

    const aPos = zone.aChannelMemberIndex ?? 0;
    writeU16Le(aChannel, zIdx * D890_MAP.AmZoneAChannelStride, aPos);

    const scanBits = encodeAmZoneScanBits(zone.channelNumbers.length, zone.scanMemberIndices);
    scan.set(scanBits, zIdx * D890_MAP.AmZoneScanStride);
  });

  image.set(D890_MAP.AmZoneSet, set);
  image.set(D890_MAP.AmZoneAChannel, aChannel);
  image.set(D890_MAP.AmZoneScan, scan);
  return image;
}

export function syncAmZoneRegionsToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.AmZoneSet, length: D890_MAP.AmZoneSetLength },
    { address: D890_MAP.AmZoneAChannel, length: D890_MAP.AmZoneAChannelLength },
    { address: D890_MAP.AmZoneScan, length: D890_MAP.AmZoneScanLength },
  ]);
  const set = image.get(D890_MAP.AmZoneSet, D890_MAP.AmZoneSetLength);
  for (const idx of listSetBits(set)) {
    putCacheBytes(
      cache,
      amZoneDataAddress(idx),
      image.get(amZoneDataAddress(idx), D890_MAP.AmZoneDataLength),
    );
  }
}

export function listAmZoneMemberIndicesFromCache(
  cache: AtD890DownloadCache,
  zoneIndex: number,
): number[] {
  const raw = getCacheBytes(cache, amZoneDataAddress(zoneIndex), D890_MAP.AmZoneDataLength);
  return decodeAmZoneRecord(raw).channelIndices0;
}

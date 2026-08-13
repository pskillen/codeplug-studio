/**
 * AT-D890UV zone encode — ZoneSet, names, membership, A/B tables.
 *
 * Occupied zones are visible unless hide is modelled (it is not today). A virgin
 * all-set ZoneHide prior must not hide every occupied zone (#1125).
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioZoneDto } from '../../radioWriteProjection.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { clearBitmap, listSetBits, setBitmapBit } from './bitmap.ts';
import { AT_D890_INVALID_U16, AT_D890_LIMITS, D890_MAP } from './constants.ts';
import {
  getCacheBytes,
  mergeMapRegionsIntoCache,
  putCacheBytes,
  zoneChannelsAddress,
  zoneNameAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { toAtD890ChannelIndex } from './channelIndex.ts';
import { encodeWideCharName } from './wideChar.ts';

function writeU16Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

export function encodeAtD890ZoneMembership(channelNumbers: readonly number[]): Uint8Array {
  const buf = new Uint8Array(D890_MAP.ZoneChannelsStride);
  buf.fill(0xff);
  const count = Math.min(channelNumbers.length, AT_D890_LIMITS.ZONE_MAX_MEMBERS);
  for (let i = 0; i < count; i++) {
    writeU16Le(buf, i * 2, toAtD890ChannelIndex(channelNumbers[i]!));
  }
  return buf;
}

export function encodeZonesIntoAtD890Image(
  image: MemoryMap,
  zones: readonly RadioZoneDto[],
): MemoryMap {
  const zoneSet = image.get(D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES).slice();
  const zoneHide = image.get(D890_MAP.ZoneHide, AT_D890_LIMITS.ZONE_SET_BYTES).slice();
  const zoneA = image.get(D890_MAP.ZoneAChannel, D890_MAP.ZoneTableBytes).slice();
  const zoneB = image.get(D890_MAP.ZoneBChannel, D890_MAP.ZoneTableBytes).slice();
  clearBitmap(zoneSet);

  const maxZones = AT_D890UV_LIMITS.ZONE_MAX;
  for (let i = 0; i < maxZones; i++) {
    writeU16Le(zoneA, i * 2, 0);
    writeU16Le(zoneB, i * 2, 1);
    image.fill(zoneNameAddress(i), D890_MAP.ZoneDataLength, 0xff);
    image.fill(zoneChannelsAddress(i), D890_MAP.ZoneChannelsStride, 0xff);
  }
  for (let i = maxZones; i < zoneSet.length * 8; i++) {
    writeU16Le(zoneA, i * 2, 0);
    writeU16Le(zoneB, i * 2, 0);
  }

  zones.forEach((zone, zIdx) => {
    if (zone.channelNumbers.length === 0) return;
    setBitmapBit(zoneSet, zIdx, true);
    const nameBytes = encodeWideCharName(zone.wireName, D890_MAP.ZoneDataLength);
    image.set(zoneNameAddress(zIdx), nameBytes);
    image.set(zoneChannelsAddress(zIdx), encodeAtD890ZoneMembership(zone.channelNumbers));
    writeU16Le(zoneA, zIdx * 2, 0);
    writeU16Le(zoneB, zIdx * 2, zone.channelNumbers.length > 1 ? 1 : 0);
  });

  for (const idx of listSetBits(zoneSet)) {
    setBitmapBit(zoneHide, idx, false);
  }

  image.set(D890_MAP.ZoneSet, zoneSet);
  image.set(D890_MAP.ZoneHide, zoneHide);
  image.set(D890_MAP.ZoneAChannel, zoneA);
  image.set(D890_MAP.ZoneBChannel, zoneB);
  return image;
}

/** Occupied ZoneSet bits whose ZoneHide bit is clear. */
export function countAtD890VisibleZones(image: MemoryMap): number {
  const zoneSet = image.get(D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES);
  const hidden = new Set(listSetBits(image.get(D890_MAP.ZoneHide, AT_D890_LIMITS.ZONE_SET_BYTES)));
  let visible = 0;
  for (const idx of listSetBits(zoneSet)) {
    if (!hidden.has(idx)) visible += 1;
  }
  return visible;
}

export const AT_D890_ZERO_VISIBLE_ZONES_MESSAGE =
  'This radio needs at least one visible zone. The AT-D890UV rejects a codeplug with no visible zones (empty ZoneSet, or every occupied zone hidden in ZoneHide) and shows Program Error Please Initialize The Radio, which erases the radio. Add a zone to the build before Write.';

/** Refuse Write when the image would present zero visible zones to firmware (#1125, #880). */
export function assertAtD890HasVisibleZones(image: MemoryMap): void {
  if (countAtD890VisibleZones(image) === 0) {
    throw new RadioProtocolError(AT_D890_ZERO_VISIBLE_ZONES_MESSAGE);
  }
}

export function syncZoneRegionsToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.ZoneSet, length: AT_D890_LIMITS.ZONE_SET_BYTES },
    { address: D890_MAP.ZoneHide, length: AT_D890_LIMITS.ZONE_SET_BYTES },
    { address: D890_MAP.ZoneAChannel, length: D890_MAP.ZoneTableBytes },
    { address: D890_MAP.ZoneBChannel, length: D890_MAP.ZoneTableBytes },
  ]);
  const set = image.get(D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES);
  for (const idx of listSetBits(set)) {
    putCacheBytes(
      cache,
      zoneNameAddress(idx),
      image.get(zoneNameAddress(idx), D890_MAP.ZoneDataLength),
    );
    putCacheBytes(
      cache,
      zoneChannelsAddress(idx),
      image.get(zoneChannelsAddress(idx), D890_MAP.ZoneChannelsStride),
    );
  }
}

export function listZoneMemberIndicesFromCache(
  cache: AtD890DownloadCache,
  zoneIndex: number,
): number[] {
  const raw = getCacheBytes(cache, zoneChannelsAddress(zoneIndex), D890_MAP.ZoneChannelsStride);
  const out: number[] = [];
  for (let off = 0; off < raw.length; off += 2) {
    const v = raw[off]! | (raw[off + 1]! << 8);
    if (v === AT_D890_INVALID_U16) break;
    out.push(v);
  }
  return out;
}

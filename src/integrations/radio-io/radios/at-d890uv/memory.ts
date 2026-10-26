/**
 * D890 sparse cache + channel address geometry.
 */

export {
  channelDataBlockIndex,
  channelDataOffsetInBlock,
  isAtD890ChannelDataAddress,
  isAtD890ChannelDataRealAddress,
} from './channelDataGeometry.ts';

import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import type { MemoryMap } from '../../types.ts';
import type { RadioWriteOrganisation } from '../../radioWriteProjection.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { ChannelDistanceUnit } from '@core/models/radioBuild.ts';
import {
  AT_D890_BLOCK_SIZE,
  AT_D890_CHANNEL_LOCATION,
  AT_D890_MAP_SIZE,
  AT_D890_LIMITS,
  D890_MAP,
} from './constants.ts';
import { eraseUnitBaseFor, AT_D890_ERASE_UNIT_BYTES } from './eraseUnits.ts';
import {
  encodeAtD890ChannelLocationTable,
  radioChannelHasTablePosition,
} from './channelLocationCodec.ts';
import { listSetBits } from './bitmap.ts';
import { assertAtD890WritableSpan, isAtD890WritableAddress } from './writableExtents.ts';
import { syncAmAirRegionsToCache } from './amAirCodec.ts';
import { syncAmZoneRegionsToCache } from './amZoneCodec.ts';
import { syncAprsRegionsToCache } from './aprsCodec.ts';

export interface AtD890SparseBlock {
  address: number;
  data: Uint8Array;
}

export interface AtD890DownloadCache {
  firmware?: string;
  modelString?: string;
  /** Absolute address → bytes (any length, 16-byte aligned). */
  blocks: Map<number, Uint8Array>;
}

export function channelPrimaryAddress(index: number): number {
  const blockIndex = Math.floor(index / D890_MAP.ChannelDataBlockSize);
  const indexInBlock = index % D890_MAP.ChannelDataBlockSize;
  return (
    D890_MAP.ChannelData +
    blockIndex * D890_MAP.ChannelDataBlockOffset +
    indexInBlock * D890_MAP.ChannelDataOffset
  );
}

export function channelSecondaryAddress(index: number): number {
  return channelPrimaryAddress(index) + D890_MAP.ChannelDataSecondaryOffset;
}

export function zoneNameAddress(zoneIndex: number): number {
  return D890_MAP.ZonesName + zoneIndex * D890_MAP.ZoneDataOffset;
}

export function zoneChannelsAddress(zoneIndex: number): number {
  return D890_MAP.ZoneChannels + zoneIndex * D890_MAP.ZoneChannelsStride;
}

export function scanListAddress(index: number): number {
  const bankIndex = Math.floor(index / D890_MAP.ScanListBankSize);
  const indexInBank = index % D890_MAP.ScanListBankSize;
  return (
    D890_MAP.ScanListData +
    bankIndex * D890_MAP.ScanListBankPitch +
    indexInBank * D890_MAP.ScanListStride
  );
}

export function talkgroupAddress(index: number): number {
  const bankIndex = Math.floor(index / D890_MAP.TalkgroupBankSize);
  const indexInBank = index % D890_MAP.TalkgroupBankSize;
  return (
    D890_MAP.TalkgroupData +
    bankIndex * D890_MAP.TalkgroupBankPitch +
    indexInBank * D890_MAP.TalkgroupStride
  );
}

/** Floor address to a 16-byte serial/cache boundary. */
export function alignDownAtD890Address(address: number): number {
  return Math.floor(address / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE;
}

/**
 * 16-aligned span covering `[address, address + length)`.
 * Needed when record stride is not a multiple of 16 (talkgroups: pitch `0xc8`).
 */
export function alignedSpanForAtD890Region(
  address: number,
  length: number,
): { start: number; length: number } {
  const start = alignDownAtD890Address(address);
  const end = Math.ceil((address + length) / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE;
  return { start, length: end - start };
}

export function receiveGroupAddress(index: number): number {
  return D890_MAP.ReceiveGroupData + index * D890_MAP.ReceiveGroupStride;
}

export function radioIdAddress(index: number): number {
  return D890_MAP.RadioIdData + index * D890_MAP.RadioIdStride;
}

export function amAirDataAddress(index: number): number {
  return D890_MAP.AmAirData + index * D890_MAP.AmAirDataStride;
}

export function amZoneDataAddress(index: number): number {
  return D890_MAP.AmZoneData + index * D890_MAP.AmZoneDataStride;
}

export function amZoneScanAddress(zoneIndex: number): number {
  return D890_MAP.AmZoneScan + zoneIndex * D890_MAP.AmZoneScanStride;
}

export function putCacheBytes(cache: AtD890DownloadCache, address: number, data: Uint8Array): void {
  if (data.length === 0) return;
  if (address % AT_D890_BLOCK_SIZE !== 0) {
    throw new RangeError(`D890 cache address must be 16-byte aligned: 0x${address.toString(16)}`);
  }
  for (let off = 0; off < data.length; off += AT_D890_BLOCK_SIZE) {
    const slice = data.subarray(off, Math.min(off + AT_D890_BLOCK_SIZE, data.length));
    if (slice.length === AT_D890_BLOCK_SIZE) {
      cache.blocks.set(address + off, slice.slice());
      continue;
    }
    const padded = new Uint8Array(AT_D890_BLOCK_SIZE);
    padded.fill(0xff);
    padded.set(slice);
    cache.blocks.set(address + off, padded);
  }
}

/** Upload-path cache merge — bounds-checked against the write allow-list. */
export function putWritableCacheBytes(
  cache: AtD890DownloadCache,
  address: number,
  data: Uint8Array,
): void {
  const { start, length: spanLen } = alignedSpanForAtD890Region(address, data.length);
  assertAtD890WritableSpan(start, spanLen);
  putCacheBytes(cache, address, data);
}

export function getCacheBytes(
  cache: AtD890DownloadCache,
  address: number,
  length: number,
): Uint8Array {
  const out = new Uint8Array(length);
  out.fill(0xff);
  let abs = address;
  const end = address + length;
  while (abs < end) {
    const blockBase = alignDownAtD890Address(abs);
    const chunk = cache.blocks.get(blockBase);
    const offsetInBlock = abs - blockBase;
    const copyLen = Math.min(AT_D890_BLOCK_SIZE - offsetInBlock, end - abs);
    if (chunk && chunk.length > offsetInBlock) {
      out.set(
        chunk.subarray(offsetInBlock, Math.min(chunk.length, offsetInBlock + copyLen)),
        abs - address,
      );
    }
    abs += copyLen;
  }
  return out;
}

export function cacheToMemoryMap(cache: AtD890DownloadCache): MemoryMap {
  const map = createMemoryMap(AT_D890_MAP_SIZE);
  map.fill(0, AT_D890_MAP_SIZE, 0xff);
  for (const [addr, data] of cache.blocks) {
    if (addr + data.length > map.size) continue;
    map.set(addr, data);
  }
  return map;
}

export function memoryMapToCacheBlocks(
  image: MemoryMap,
  addresses: readonly number[],
): Map<number, Uint8Array> {
  const out = new Map<number, Uint8Array>();
  for (const addr of addresses) {
    const existing = out.get(addr);
    const len = existing?.length ?? AT_D890_BLOCK_SIZE;
    const data = image.get(addr, len);
    out.set(addr, data.slice());
  }
  return out;
}

/** Expand stored regions into 16-byte write chunks (sorted, unique). Allow-list only. */
export function listWriteChunks(
  cache: AtD890DownloadCache,
  skipAddr = 0,
): { address: number; data: Uint8Array }[] {
  const chunks: { address: number; data: Uint8Array }[] = [];
  const addrs = [...cache.blocks.keys()].sort((a, b) => a - b);
  for (const base of addrs) {
    const data = cache.blocks.get(base)!;
    for (let off = 0; off < data.length; off += AT_D890_BLOCK_SIZE) {
      const addr = base + off;
      if (addr === skipAddr) continue;
      if (!isAtD890WritableAddress(addr)) continue;
      chunks.push({ address: addr, data: data.subarray(off, off + AT_D890_BLOCK_SIZE) });
    }
  }
  return chunks;
}

export function alignAtD890ReadLength(length: number): number {
  return Math.ceil(length / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE;
}

/**
 * Drop cached blocks in the TalkgroupData bank so a prior Read with a wrong
 * stride (e.g. `0xd0`) cannot leak stale addresses into upload.
 */
export function clearTalkgroupDataBlocksFromCache(cache: AtD890DownloadCache): void {
  const base = D890_MAP.TalkgroupData;
  const end = D890_MAP.TalkgroupOrder;
  for (const addr of [...cache.blocks.keys()]) {
    if (addr >= base && addr < end) cache.blocks.delete(addr);
  }
}

/** Drop cached TalkgroupOrder blocks before rewriting the order table on upload. */
export function clearTalkgroupOrderBlocksFromCache(cache: AtD890DownloadCache): void {
  const base = D890_MAP.TalkgroupOrder;
  const end = base + 0x1000;
  for (const addr of [...cache.blocks.keys()]) {
    if (addr >= base && addr < end) cache.blocks.delete(addr);
  }
}

/**
 * Drop cached TalkgroupPosition blocks before rewriting the list-count table.
 * A short factory block (`00 00 00 00` then `FF`) must not survive inside the span.
 */
export function clearTalkgroupPositionBlocksFromCache(cache: AtD890DownloadCache): void {
  const base = D890_MAP.TalkgroupPosition;
  const end = base + AT_D890UV_LIMITS.TALK_GROUPS_MAX * 4;
  for (const addr of [...cache.blocks.keys()]) {
    if (addr >= base && addr < end) cache.blocks.delete(addr);
  }
}

/**
 * Drop cached AmAir / AmZone blocks so a DMR-only Write does not re-stage the
 * airband erase unit (retain-when-empty product rule — #756).
 */
export function clearAmAirBankBlocksFromCache(cache: AtD890DownloadCache): void {
  const spans: { base: number; end: number }[] = [
    {
      base: D890_MAP.AmAirData,
      end: D890_MAP.AmAirData + D890_MAP.AmAirDataStride * D890_MAP.AmAirCount,
    },
    { base: D890_MAP.AmAirVfo, end: D890_MAP.AmAirVfo + D890_MAP.AmAirVfoLength },
    { base: D890_MAP.AmAirSet, end: D890_MAP.AmAirSet + D890_MAP.AmAirSetLength },
    { base: D890_MAP.AmZoneSet, end: D890_MAP.AmZoneSet + D890_MAP.AmZoneSetLength },
    { base: D890_MAP.AmZoneAChannel, end: D890_MAP.AmZoneAChannel + D890_MAP.AmZoneAChannelLength },
    { base: D890_MAP.AmZoneScan, end: D890_MAP.AmZoneScan + D890_MAP.AmZoneScanLength },
    {
      base: D890_MAP.AmZoneData,
      end: D890_MAP.AmZoneData + D890_MAP.AmZoneDataStride * D890_MAP.AmZoneCount,
    },
  ];
  for (const addr of [...cache.blocks.keys()]) {
    if (spans.some((s) => addr >= s.base && addr < s.end)) cache.blocks.delete(addr);
  }
}

/**
 * Drop cached VFO A/B channel blocks (slots 4000/4001). Read captures them for Backup, but a
 * Write never models them, and staging them would rewrite the `0x01F80000` erase unit.
 */
export function clearVfoChannelBlocksFromCache(cache: AtD890DownloadCache): void {
  const base = D890_MAP.VfoChannels;
  const end = base + D890_MAP.VfoChannelsLength;
  for (const addr of [...cache.blocks.keys()]) {
    if (addr >= base && addr < end) cache.blocks.delete(addr);
  }
}

/** Merge a possibly unaligned image region into 16-byte cache keys. */
export function mergeImageRegionIntoCache(
  cache: AtD890DownloadCache,
  image: MemoryMap,
  address: number,
  length: number,
): void {
  const { start, length: spanLen } = alignedSpanForAtD890Region(address, length);
  assertAtD890WritableSpan(start, spanLen);
  for (let off = 0; off < spanLen; off += AT_D890_BLOCK_SIZE) {
    putCacheBytes(cache, start + off, image.get(start + off, AT_D890_BLOCK_SIZE));
  }
}

/** Upload intent for banks that hydration encodes but Read may not have cached. */
export type AtD890UploadBankIntent = {
  /** When true, stage AmAir/AmZone from the write image (both keys were projected). */
  replaceAmAirBank: boolean;
  /** When true, stage TalkgroupOrder rebuilt in the write image. */
  replaceTalkgroupOrder: boolean;
  /**
   * MM9PDY AT-D890UV. When true, upload patches P1/P2 short on the fresh
   * optional-settings erase unit. Does not synthesize the settings record.
   */
  assignMm9pdyStepKeys?: boolean;
  /**
   * MM9PDY AT-D890UV. When set, the cache merge encodes the channel location table from the
   * write image (after the channel encode) and stages it at the A half of the dedicated
   * pair. Upload owns that whole erase unit: it never carries bytes over from the fresh read.
   * Stock intents leave this unset and never touch the pair.
   */
  channelLocationTable?: {
    /** Channels that carry a table position (slot-aligned DTOs). */
    channels: readonly RadioChannelDto[];
    unit: ChannelDistanceUnit;
  };
};

export function atD890UploadBankIntentFromOrganisation(
  organisation?: RadioWriteOrganisation,
  channels?: readonly RadioChannelDto[],
): AtD890UploadBankIntent {
  return {
    replaceAmAirBank:
      organisation?.amAirChannels !== undefined && organisation?.amZones !== undefined,
    replaceTalkgroupOrder: organisation?.talkGroups !== undefined,
    assignMm9pdyStepKeys: organisation?.assignMm9pdyStepKeys === true,
    ...(organisation?.writeChannelLocationTable === true
      ? {
          channelLocationTable: {
            channels: (channels ?? []).filter(radioChannelHasTablePosition),
            unit: organisation.channelDistanceUnit ?? 'km',
          },
        }
      : {}),
  };
}

/** Erase-unit base Studio stages the channel location table in (A half of the pair). */
export const AT_D890_CHANNEL_LOCATION_UNIT_BASE = eraseUnitBaseFor(
  AT_D890_CHANNEL_LOCATION.BASE_ADDRESS,
);

/** True for any address inside the dedicated location pair (A or B half). */
export function isAtD890ChannelLocationPairAddress(address: number): boolean {
  return (
    address >= AT_D890_CHANNEL_LOCATION.BASE_ADDRESS &&
    address < AT_D890_CHANNEL_LOCATION.PAIR_B_ADDRESS + AT_D890_ERASE_UNIT_BYTES
  );
}

/** Drop every cached block in the location pair so nothing stale reaches upload. */
export function clearChannelLocationBlocksFromCache(cache: AtD890DownloadCache): void {
  for (const addr of [...cache.blocks.keys()]) {
    if (isAtD890ChannelLocationPairAddress(addr)) cache.blocks.delete(addr);
  }
}

/**
 * Stage the channel location table for this upload. Always clears the pair from the cache
 * first, so a stock intent never sends it and an MM9PDY intent sends only this table.
 * Returns the staged byte length (0 when nothing was staged).
 */
export function stageAtD890ChannelLocationTable(
  cache: AtD890DownloadCache,
  image: MemoryMap,
  intent: AtD890UploadBankIntent,
): number {
  clearChannelLocationBlocksFromCache(cache);
  const table = intent.channelLocationTable;
  if (!table) return 0;
  const { bytes } = encodeAtD890ChannelLocationTable(image, table.channels, table.unit);
  putWritableCacheBytes(cache, AT_D890_CHANNEL_LOCATION.BASE_ADDRESS, bytes);
  return bytes.length;
}

/** Push modelled regions from a merged MemoryMap back into the upload cache. */
export function applyAtD890WriteImageToCache(
  cache: AtD890DownloadCache,
  image: MemoryMap,
  intent: AtD890UploadBankIntent = {
    replaceAmAirBank: false,
    replaceTalkgroupOrder: false,
  },
): void {
  const staticRegions: { address: number; length: number }[] = [
    { address: D890_MAP.ChannelSet, length: AT_D890_LIMITS.CHANNEL_SET_BYTES },
    { address: D890_MAP.ZoneSet, length: AT_D890_LIMITS.ZONE_SET_BYTES },
    { address: D890_MAP.ZoneHide, length: AT_D890_LIMITS.ZONE_SET_BYTES },
    { address: D890_MAP.ZoneAChannel, length: D890_MAP.ZoneTableBytes },
    { address: D890_MAP.ZoneBChannel, length: D890_MAP.ZoneTableBytes },
    { address: D890_MAP.RadioIdSet, length: AT_D890_LIMITS.RADIO_ID_SET_BYTES },
    { address: D890_MAP.ScanListSet, length: AT_D890_LIMITS.SCAN_LIST_SET_BYTES },
    { address: D890_MAP.TalkgroupSet, length: AT_D890_LIMITS.TALKGROUP_SET_BYTES },
    { address: D890_MAP.ReceiveGroupSet, length: AT_D890_LIMITS.RX_GROUP_SET_BYTES },
    { address: D890_MAP.MasterIdData, length: D890_MAP.MasterIdLength },
  ];
  clearVfoChannelBlocksFromCache(cache);
  mergeMapRegionsIntoCache(cache, image, staticRegions);
  // AprsConfigMain is modelled (patch-only) but not in staticRegions — without this,
  // listWriteChunks retransmits stale Read bytes and digital report slots never Upload (#884).
  syncAprsRegionsToCache(cache, image);

  const channelSet = image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
  for (const idx of listSetBits(channelSet)) {
    putWritableCacheBytes(
      cache,
      channelPrimaryAddress(idx),
      image.get(channelPrimaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    );
    putWritableCacheBytes(
      cache,
      channelSecondaryAddress(idx),
      image.get(channelSecondaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    );
  }

  const zoneSet = image.get(D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES);
  for (const idx of listSetBits(zoneSet)) {
    putWritableCacheBytes(
      cache,
      zoneNameAddress(idx),
      image.get(zoneNameAddress(idx), D890_MAP.ZoneDataLength),
    );
    putWritableCacheBytes(
      cache,
      zoneChannelsAddress(idx),
      image.get(zoneChannelsAddress(idx), D890_MAP.ZoneChannelsStride),
    );
  }

  const scanSet = image.get(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
  for (const idx of listSetBits(scanSet)) {
    putWritableCacheBytes(
      cache,
      scanListAddress(idx),
      image.get(scanListAddress(idx), AT_D890_LIMITS.SCAN_LIST_STRIDE),
    );
  }

  clearTalkgroupDataBlocksFromCache(cache);
  const tgSet = image.get(D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES);
  for (const idx of listSetBits(tgSet, true)) {
    mergeImageRegionIntoCache(
      cache,
      image,
      talkgroupAddress(idx),
      AT_D890_LIMITS.TALKGROUP_RECORD_SIZE,
    );
  }

  const rxSet = image.get(D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES);
  for (const idx of listSetBits(rxSet)) {
    putWritableCacheBytes(
      cache,
      receiveGroupAddress(idx),
      image.get(receiveGroupAddress(idx), AT_D890_LIMITS.RX_GROUP_STRIDE),
    );
  }

  const ridSet = image.get(D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES);
  for (const idx of listSetBits(ridSet)) {
    putWritableCacheBytes(
      cache,
      radioIdAddress(idx),
      image.get(radioIdAddress(idx), AT_D890_LIMITS.RADIO_ID_STRIDE),
    );
  }

  if (intent.replaceTalkgroupOrder) {
    clearTalkgroupOrderBlocksFromCache(cache);
    mergeImageRegionIntoCache(cache, image, D890_MAP.TalkgroupOrder, 0x1000);
    clearTalkgroupPositionBlocksFromCache(cache);
    mergeImageRegionIntoCache(
      cache,
      image,
      D890_MAP.TalkgroupPosition,
      AT_D890UV_LIMITS.TALK_GROUPS_MAX * 4,
    );
  }

  if (intent.replaceAmAirBank) {
    clearAmAirBankBlocksFromCache(cache);
    syncAmAirRegionsToCache(cache, image);
    syncAmZoneRegionsToCache(cache, image);
  }

  stageAtD890ChannelLocationTable(cache, image, intent);
}

export function mergeMapRegionsIntoCache(
  cache: AtD890DownloadCache,
  image: MemoryMap,
  regions: readonly { address: number; length: number }[],
): void {
  for (const { address, length } of regions) {
    mergeImageRegionIntoCache(cache, image, address, length);
  }
}

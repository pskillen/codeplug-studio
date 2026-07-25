/**
 * D890 sparse cache + channel address geometry.
 */

import { createMemoryMap } from '../../kit/memoryMap.ts';
import type { MemoryMap } from '../../types.ts';
import { AT_D890_BLOCK_SIZE, AT_D890_MAP_SIZE, AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { listSetBits } from './bitmap.ts';

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
  return D890_MAP.ScanListData + index * D890_MAP.ScanListStride;
}

export function talkgroupAddress(index: number): number {
  return D890_MAP.TalkgroupData + index * D890_MAP.TalkgroupStride;
}

export function receiveGroupAddress(index: number): number {
  return D890_MAP.ReceiveGroupData + index * D890_MAP.ReceiveGroupStride;
}

export function radioIdAddress(index: number): number {
  return D890_MAP.RadioIdData + index * D890_MAP.RadioIdStride;
}

export function putCacheBytes(cache: AtD890DownloadCache, address: number, data: Uint8Array): void {
  if (data.length === 0) return;
  if (address % AT_D890_BLOCK_SIZE !== 0) {
    throw new RangeError(`D890 cache address must be 16-byte aligned: 0x${address.toString(16)}`);
  }
  cache.blocks.set(address, data.slice());
}

export function getCacheBytes(
  cache: AtD890DownloadCache,
  address: number,
  length: number,
): Uint8Array {
  const out = new Uint8Array(length);
  out.fill(0xff);
  for (let off = 0; off < length; off += AT_D890_BLOCK_SIZE) {
    const addr = address + off;
    const chunk = cache.blocks.get(addr);
    if (chunk) {
      out.set(chunk.subarray(0, Math.min(chunk.length, length - off)), off);
    }
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

/** Expand stored regions into 16-byte write chunks (sorted, unique). */
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
      chunks.push({ address: addr, data: data.subarray(off, off + AT_D890_BLOCK_SIZE) });
    }
  }
  return chunks;
}

export function alignAtD890ReadLength(length: number): number {
  return Math.ceil(length / AT_D890_BLOCK_SIZE) * AT_D890_BLOCK_SIZE;
}

/** Push modelled regions from a merged MemoryMap back into the upload cache. */
export function applyAtD890WriteImageToCache(cache: AtD890DownloadCache, image: MemoryMap): void {
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
  mergeMapRegionsIntoCache(cache, image, staticRegions);

  const channelSet = image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES);
  for (const idx of listSetBits(channelSet)) {
    putCacheBytes(
      cache,
      channelPrimaryAddress(idx),
      image.get(channelPrimaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    );
    putCacheBytes(
      cache,
      channelSecondaryAddress(idx),
      image.get(channelSecondaryAddress(idx), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE),
    );
  }

  const zoneSet = image.get(D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES);
  for (const idx of listSetBits(zoneSet)) {
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

  const scanSet = image.get(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
  for (const idx of listSetBits(scanSet)) {
    putCacheBytes(
      cache,
      scanListAddress(idx),
      image.get(scanListAddress(idx), AT_D890_LIMITS.SCAN_LIST_STRIDE),
    );
  }

  const tgSet = image.get(D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES);
  for (const idx of listSetBits(tgSet, true)) {
    putCacheBytes(
      cache,
      talkgroupAddress(idx),
      image.get(talkgroupAddress(idx), AT_D890_LIMITS.TALKGROUP_IO_LENGTH),
    );
  }

  const rxSet = image.get(D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES);
  for (const idx of listSetBits(rxSet)) {
    putCacheBytes(
      cache,
      receiveGroupAddress(idx),
      image.get(receiveGroupAddress(idx), AT_D890_LIMITS.RX_GROUP_STRIDE),
    );
  }

  const ridSet = image.get(D890_MAP.RadioIdSet, AT_D890_LIMITS.RADIO_ID_SET_BYTES);
  for (const idx of listSetBits(ridSet)) {
    putCacheBytes(
      cache,
      radioIdAddress(idx),
      image.get(radioIdAddress(idx), AT_D890_LIMITS.RADIO_ID_STRIDE),
    );
  }
}

export function mergeMapRegionsIntoCache(
  cache: AtD890DownloadCache,
  image: MemoryMap,
  regions: readonly { address: number; length: number }[],
): void {
  for (const { address, length } of regions) {
    for (let off = 0; off < length; off += AT_D890_BLOCK_SIZE) {
      const addr = address + off;
      const slice = image.get(addr, Math.min(AT_D890_BLOCK_SIZE, length - off));
      putCacheBytes(cache, addr, slice);
    }
  }
}

/**
 * Bridge MemoryMap ↔ egress radio-clone hydration for DM-32UV (sparse blocks).
 */

import {
  createRadioCloneHydrationBagFromBlocks,
  radioCloneSparseBlockBytes,
  type RadioCloneHydrationBag,
} from '@core/models/radioCloneHydration.ts';
import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE, DM32_MODEL_IDS } from './constants.ts';
import { encodeChannelsIntoDm32Image, type Dm32ChannelDecodeContext } from './channelCodec.ts';
import type { Dm32DownloadCache } from './protocol.ts';

export const DM32UV_MODEL_ID = DM32_MODEL_IDS[0];

function cacheFromBag(bag: RadioCloneHydrationBag): Dm32DownloadCache {
  const blocks = new Map<number, Uint8Array>();
  for (const b of radioCloneSparseBlockBytes(bag)) {
    blocks.set(b.address, b.data);
  }
  const addresses = [...blocks.keys()].sort((a, b) => a - b);
  const addressBase = bag.retain.addressBase ?? addresses[0] ?? 0;
  const last = addresses[addresses.length - 1] ?? addressBase;
  const mapSize = last - addressBase + DM32_BLOCK_SIZE;
  const discovered = addresses.map((address) => ({
    address,
    metadata: blocks.get(address)![DM32_BLOCK_SIZE - 1]!,
    type: 'unknown' as const,
  }));
  return {
    addressBase,
    mapSize,
    firmware: bag.retain.firmware,
    discovered,
    blocks,
  };
}

export function memoryMapFromDm32uvHydration(bag: RadioCloneHydrationBag): MemoryMap {
  const cache = cacheFromBag(bag);
  const map = createMemoryMap(cache.mapSize);
  map.fill(0, cache.mapSize, 0xff);
  for (const [addr, data] of cache.blocks) {
    map.set(addr - cache.addressBase, data);
  }
  return map;
}

export function extractDm32uvHydration(
  image: MemoryMap,
  meta?: { sourceFileName?: string; capturedAt?: string; cache?: Dm32DownloadCache },
): RadioCloneHydrationBag {
  const cache = meta?.cache;
  if (!cache || cache.blocks.size === 0) {
    // Fall back: treat entire map as one synthetic block at addressBase 0 (tests only).
    const blocks = [{ address: 0, data: image.bytes.slice() }];
    return createRadioCloneHydrationBagFromBlocks({
      radioModelId: DM32UV_MODEL_ID,
      blocks,
      addressBase: 0,
      capturedVia: 'web-serial',
      sourceFileName: meta?.sourceFileName,
      capturedAt: meta?.capturedAt,
    });
  }
  const blockList = [...cache.blocks.entries()].map(([address, data]) => ({
    address,
    data: data.slice(),
  }));
  return createRadioCloneHydrationBagFromBlocks({
    radioModelId: DM32UV_MODEL_ID,
    blocks: blockList,
    addressBase: cache.addressBase,
    firmware: cache.firmware,
    capturedVia: 'web-serial',
    sourceFileName: meta?.sourceFileName,
    capturedAt: meta?.capturedAt,
  });
}

/**
 * Protocol-aware extract used by descriptor hooks when download cache is available.
 * Session download path should call {@link extractDm32uvHydrationFromProtocol}.
 */
export function extractDm32uvHydrationFromProtocol(
  image: MemoryMap,
  cache: Dm32DownloadCache,
  meta?: { sourceFileName?: string; capturedAt?: string },
): RadioCloneHydrationBag {
  return extractDm32uvHydration(image, { ...meta, cache });
}

export function mergeChannelsIntoDm32uvHydration(
  bag: RadioCloneHydrationBag,
  channels: readonly RadioChannelDto[],
): MemoryMap {
  const cache = cacheFromBag(bag);
  const image = memoryMapFromDm32uvHydration(bag);
  const ctx: Dm32ChannelDecodeContext = {
    addressBase: cache.addressBase,
    discovered: cache.discovered,
  };
  return encodeChannelsIntoDm32Image(image, ctx, channels);
}

/**
 * Remap sparse DM-32UV hydration blocks onto live absolute addresses by metadata tag.
 * Used before Write when factory reset / CPS rewrite moves banks within the V-frame range.
 */

import type { MemoryMap } from '../../types.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import { classifyDm32Metadata, type Dm32DiscoveredBlock } from './memory.ts';

export interface Dm32AddressTranslation {
  from: number;
  to: number;
  metadata: number;
}

export interface Dm32RemapMissingTag {
  metadata: number;
  seededAddress: number;
}

export type Dm32RemapBlocksResult =
  | {
      ok: true;
      blocks: Map<number, Uint8Array>;
      discovered: Dm32DiscoveredBlock[];
      translations: Dm32AddressTranslation[];
    }
  | { ok: false; missing: Dm32RemapMissingTag[] };

function metadataForSeededBlock(
  address: number,
  data: Uint8Array,
  seededDiscovered: readonly Dm32DiscoveredBlock[],
): number {
  const known = seededDiscovered.find((b) => b.address === address);
  return known?.metadata ?? data[DM32_BLOCK_SIZE - 1] ?? DM32_METADATA.EMPTY_ALT;
}

function isSkippableMetadata(metadata: number): boolean {
  return metadata === DM32_METADATA.EMPTY || metadata === DM32_METADATA.EMPTY_ALT;
}

/**
 * Re-bind seeded sparse blocks onto live absolute addresses using metadata tags.
 * Skips empty tags. When multiple live blocks share a tag, assigns in address order.
 */
export function remapDm32BlocksByMetadata(
  seededBlocks: ReadonlyMap<number, Uint8Array>,
  seededDiscovered: readonly Dm32DiscoveredBlock[],
  liveDiscovered: readonly Dm32DiscoveredBlock[],
): Dm32RemapBlocksResult {
  const liveByMetadata = new Map<number, Dm32DiscoveredBlock[]>();
  for (const block of liveDiscovered) {
    if (isSkippableMetadata(block.metadata)) continue;
    const list = liveByMetadata.get(block.metadata) ?? [];
    list.push(block);
    liveByMetadata.set(block.metadata, list);
  }
  for (const list of liveByMetadata.values()) {
    list.sort((a, b) => a.address - b.address);
  }

  const usedLiveAddresses = new Set<number>();
  const nextLiveIndex = new Map<number, number>();
  const blocks = new Map<number, Uint8Array>();
  const discovered: Dm32DiscoveredBlock[] = [];
  const translations: Dm32AddressTranslation[] = [];
  const missing: Dm32RemapMissingTag[] = [];

  const seededAddresses = [...seededBlocks.keys()].sort((a, b) => a - b);
  for (const fromAddress of seededAddresses) {
    const data = seededBlocks.get(fromAddress)!;
    const metadata = metadataForSeededBlock(fromAddress, data, seededDiscovered);
    if (isSkippableMetadata(metadata)) continue;

    const candidates = liveByMetadata.get(metadata) ?? [];
    let liveBlock: Dm32DiscoveredBlock | undefined;
    const startIndex = nextLiveIndex.get(metadata) ?? 0;
    for (let i = startIndex; i < candidates.length; i++) {
      const candidate = candidates[i]!;
      if (!usedLiveAddresses.has(candidate.address)) {
        liveBlock = candidate;
        nextLiveIndex.set(metadata, i + 1);
        break;
      }
    }

    if (!liveBlock) {
      missing.push({ metadata, seededAddress: fromAddress });
      continue;
    }

    usedLiveAddresses.add(liveBlock.address);
    const payload = data.slice();
    blocks.set(liveBlock.address, payload);
    discovered.push({
      address: liveBlock.address,
      metadata,
      type: classifyDm32Metadata(metadata),
    });
    if (fromAddress !== liveBlock.address) {
      translations.push({ from: fromAddress, to: liveBlock.address, metadata });
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }
  return { ok: true, blocks, discovered, translations };
}

/**
 * Copy translated 4KB blocks from a hydration MemoryMap (old base) onto live addresses.
 */
export function remapDm32MemoryMapByTranslations(
  image: MemoryMap,
  oldAddressBase: number,
  newAddressBase: number,
  newMapSize: number,
  translations: readonly Dm32AddressTranslation[],
  allTargetAddresses: readonly number[],
): MemoryMap {
  const remapped = createMemoryMap(newMapSize);
  remapped.fill(0, newMapSize, 0xff);

  for (const address of allTargetAddresses) {
    const offset = address - newAddressBase;
    if (offset < 0 || offset + DM32_BLOCK_SIZE > newMapSize) continue;
    const sourceOffset = address - oldAddressBase;
    if (sourceOffset >= 0 && sourceOffset + DM32_BLOCK_SIZE <= image.size) {
      remapped.set(offset, image.get(sourceOffset, DM32_BLOCK_SIZE));
    }
  }

  for (const { from, to } of translations) {
    const oldOffset = from - oldAddressBase;
    const newOffset = to - newAddressBase;
    if (oldOffset < 0 || oldOffset + DM32_BLOCK_SIZE > image.size) continue;
    if (newOffset < 0 || newOffset + DM32_BLOCK_SIZE > newMapSize) continue;
    remapped.set(newOffset, image.get(oldOffset, DM32_BLOCK_SIZE));
  }

  return remapped;
}

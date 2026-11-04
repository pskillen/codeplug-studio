/**
 * OpenUV380 contiguous MemoryMap helpers — span fill, sector dirty tracking.
 * Cite: docs/reference/radios/opengd77/memory-layout.md
 */

import type { MemoryMap } from '../../types.ts';
import { createMemoryMap, memoryMapFromBytes, memoryMapToBytes } from '../../kit/memoryMap.ts';
import {
  OPENGD77_BLOCK,
  OPENGD77_SECTOR,
  OPENUV380_FLASH_SPANS,
  OPENUV380_IMAGE_SIZE,
  openUv380AbsToOffset,
  openUv380OffsetToAbs,
} from './constants.ts';

/** Allocate an empty OpenUV380 image (0xff fill). */
export function createOpenUv380Image(): MemoryMap {
  const map = createMemoryMap(OPENUV380_IMAGE_SIZE);
  map.fill(0, OPENUV380_IMAGE_SIZE, 0xff);
  return map;
}

export function openUv380ImageFromBytes(bytes: Uint8Array): MemoryMap {
  if (bytes.length < OPENUV380_IMAGE_SIZE) {
    throw new RangeError(
      `OpenUV380 image expects ≥ 0x${OPENUV380_IMAGE_SIZE.toString(16)} bytes, got ${bytes.length}`,
    );
  }
  return memoryMapFromBytes(bytes.subarray(0, OPENUV380_IMAGE_SIZE));
}

export function openUv380ImageToBytes(map: MemoryMap): Uint8Array {
  return memoryMapToBytes(map);
}

/** Write a payload into the image at an absolute FLASH address. */
export function writeAbs(map: MemoryMap, abs: number, data: Uint8Array): void {
  map.set(openUv380AbsToOffset(abs), data);
}

/** Read length bytes from absolute FLASH address. */
export function readAbs(map: MemoryMap, abs: number, length: number): Uint8Array {
  return map.get(openUv380AbsToOffset(abs), length);
}

/** Whether an absolute address falls inside a registered FLASH span. */
export function isRegisteredAbs(abs: number): boolean {
  for (const span of OPENUV380_FLASH_SPANS) {
    if (abs >= span.start && abs < span.start + span.length) return true;
  }
  return false;
}

export interface DirtySector {
  /** Absolute sector start address (multiple of 4096). */
  sectorAbs: number;
  /**
   * Full 4 KiB sector image. Only the bytes of {@link blocks} are ever sent; the rest is 0xff
   * filler that the radio never receives.
   */
  payload: Uint8Array;
  /**
   * Offsets (multiples of 32, ascending) of the blocks to send: exactly the 32-byte blocks inside
   * registered spans. The firmware loads the sector into its buffer at SET_SECTOR and keeps the
   * bytes it is not sent, so blocks outside the spans (the radio's own settings at 0x604B+, the
   * QuickKeys gap, ...) stay as they are on the radio.
   */
  blocks: readonly number[];
}

/** Every block offset of a sector, for payloads the host fully owns (User Database). */
export function allSectorBlocks(): readonly number[] {
  const blocks: number[] = [];
  for (let off = 0; off < OPENGD77_SECTOR; off += OPENGD77_BLOCK) blocks.push(off);
  return blocks;
}

/**
 * Span edges must sit on 32-byte block boundaries, or a block could straddle a span edge and send
 * bytes the host does not own. Throws a RangeError otherwise.
 */
export function assertSpansBlockAligned(
  spans: readonly { start: number; length: number }[] = OPENUV380_FLASH_SPANS,
): void {
  for (const span of spans) {
    if (span.start % OPENGD77_BLOCK !== 0 || span.length % OPENGD77_BLOCK !== 0) {
      throw new RangeError(
        `OpenGD77 FLASH span 0x${span.start.toString(16)}+0x${span.length.toString(16)} is not ${OPENGD77_BLOCK}-byte aligned`,
      );
    }
  }
}

/**
 * Compare `next` against `prior` and collect dirty FLASH sectors that intersect
 * registered spans. Only bytes inside registered spans are considered.
 */
export function collectDirtySectors(prior: MemoryMap, next: MemoryMap): DirtySector[] {
  if (prior.size !== next.size || prior.size !== OPENUV380_IMAGE_SIZE) {
    throw new RangeError('OpenUV380 dirty compare requires full image maps');
  }
  assertSpansBlockAligned();
  const dirtySectorStarts = new Set<number>();
  for (const span of OPENUV380_FLASH_SPANS) {
    const startOff = openUv380AbsToOffset(span.start);
    for (let i = 0; i < span.length; i++) {
      const off = startOff + i;
      if (prior.bytes[off] !== next.bytes[off]) {
        const abs = openUv380OffsetToAbs(off);
        dirtySectorStarts.add(Math.floor(abs / OPENGD77_SECTOR) * OPENGD77_SECTOR);
      }
    }
  }

  const sectors: DirtySector[] = [];
  for (const sectorAbs of [...dirtySectorStarts].sort((a, b) => a - b)) {
    const payload = new Uint8Array(OPENGD77_SECTOR);
    payload.fill(0xff);
    const blocks: number[] = [];
    for (let blockOff = 0; blockOff < OPENGD77_SECTOR; blockOff += OPENGD77_BLOCK) {
      // Aligned spans: a block is wholly inside a span or wholly outside every span.
      if (!isRegisteredAbs(sectorAbs + blockOff)) continue;
      blocks.push(blockOff);
      for (let i = blockOff; i < blockOff + OPENGD77_BLOCK; i++) {
        payload[i] = next.bytes[openUv380AbsToOffset(sectorAbs + i)]!;
      }
    }
    sectors.push({ sectorAbs, payload, blocks });
  }
  return sectors;
}

/** Total bytes transferred when downloading all registered spans. */
export function openUv380DownloadByteCount(): number {
  return OPENUV380_FLASH_SPANS.reduce((sum, s) => sum + s.length, 0);
}

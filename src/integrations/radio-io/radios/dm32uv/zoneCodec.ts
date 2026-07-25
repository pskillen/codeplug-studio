/**
 * DM-32UV zone encode — metadata 0x5c blocks.
 * Cite: NeonPlug encodeZone + writeZones packing; tier-3 contacts-zones-lists.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioZoneDto } from '../../radioWriteProjection.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';

export const DM32_ZONE_ENTRY_SIZE = 145;
export const DM32_ZONE_START_OFFSET = 16;
export const DM32_ZONE_MAX_MEMBERS = 64;

/** Zone bank first-block header — qDMR ZoneBankElement offsets (1-based wire; 0 = unset). */
export const DM32_ZONE_HEADER_CHANNEL_INDEX_A = 0x01;
export const DM32_ZONE_HEADER_CHANNEL_INDEX_B = 0x03;
export const DM32_ZONE_HEADER_ZONE_INDEX_A = 0x05;
export const DM32_ZONE_HEADER_ZONE_INDEX_B = 0x07;

function clampWireSelectionIndex(wireValue: number, maxCount: number): number {
  if (wireValue === 0) return 0;
  if (maxCount <= 0) return 0;
  if (wireValue > maxCount) return 1;
  return wireValue;
}

/** Sanitize VFO A/B selected zone+channel indices after a shrink (prevents radio UI hang). */
export function sanitizeDm32ZoneBankHeader(
  image: MemoryMap,
  blockBase: number,
  zoneCount: number,
  channelCount: number,
): void {
  if (blockBase + DM32_ZONE_START_OFFSET > image.size) return;
  image.bytes[blockBase + DM32_ZONE_HEADER_CHANNEL_INDEX_A] = clampWireSelectionIndex(
    image.bytes[blockBase + DM32_ZONE_HEADER_CHANNEL_INDEX_A]!,
    channelCount,
  );
  image.bytes[blockBase + DM32_ZONE_HEADER_CHANNEL_INDEX_B] = clampWireSelectionIndex(
    image.bytes[blockBase + DM32_ZONE_HEADER_CHANNEL_INDEX_B]!,
    channelCount,
  );
  image.bytes[blockBase + DM32_ZONE_HEADER_ZONE_INDEX_A] = clampWireSelectionIndex(
    image.bytes[blockBase + DM32_ZONE_HEADER_ZONE_INDEX_A]!,
    zoneCount,
  );
  image.bytes[blockBase + DM32_ZONE_HEADER_ZONE_INDEX_B] = clampWireSelectionIndex(
    image.bytes[blockBase + DM32_ZONE_HEADER_ZONE_INDEX_B]!,
    zoneCount,
  );
}

const TE = new TextEncoder();

function clearDm32ZoneSlot(image: MemoryMap, slotOff: number): void {
  image.bytes.fill(0xff, slotOff, slotOff + DM32_ZONE_ENTRY_SIZE);
  image.bytes[slotOff] = 0x00;
  image.bytes[slotOff + 16] = 0x00;
}

/** Encode one zone to a 145-byte record (0xFF pad; no 0x0000 member terminator). */
export function encodeDm32Zone(zone: RadioZoneDto): Uint8Array {
  const data = new Uint8Array(DM32_ZONE_ENTRY_SIZE);
  data.fill(0xff);

  const nameBytes = TE.encode(zone.wireName.slice(0, 10));
  const nameLength = Math.min(nameBytes.length, 10);
  data.set(nameBytes.subarray(0, nameLength), 0);
  data[nameLength] = 0;
  for (let i = nameLength + 1; i < 11; i++) data[i] = 0xff;

  const channelCount = Math.min(zone.channelNumbers.length, DM32_ZONE_MAX_MEMBERS);
  data[16] = channelCount;
  for (let i = 0; i < channelCount; i++) {
    const ch = zone.channelNumbers[i]!;
    const off = 17 + i * 2;
    data[off] = ch & 0xff;
    data[off + 1] = (ch >>> 8) & 0xff;
  }
  return data;
}

export interface Dm32ZoneEncodeContext {
  addressBase: number;
  discovered: readonly { address: number; metadata: number }[];
}

export interface Dm32ZoneEncodeOptions {
  /** 1-based max occupied channel slot after projection (for header clamp). */
  channelCount?: number;
}

/**
 * Rewrite all zone blocks (0x5c) from the projection.
 * First block: zones @ offset 16, byte0 = count in first block; later blocks @ 0.
 */
export function encodeZonesIntoDm32Image(
  image: MemoryMap,
  ctx: Dm32ZoneEncodeContext,
  zones: readonly RadioZoneDto[],
  options?: Dm32ZoneEncodeOptions,
): MemoryMap {
  const zoneBlocks = ctx.discovered
    .filter((b) => b.metadata === DM32_METADATA.ZONE)
    .sort((a, b) => a.address - b.address);
  if (zoneBlocks.length === 0) return image;

  const maxFirst = Math.floor((DM32_BLOCK_SIZE - DM32_ZONE_START_OFFSET) / DM32_ZONE_ENTRY_SIZE);
  const maxPerLater = Math.floor(DM32_BLOCK_SIZE / DM32_ZONE_ENTRY_SIZE);

  const encoded = zones.map((z) => encodeDm32Zone(z));

  for (let blockIdx = 0; blockIdx < zoneBlocks.length; blockIdx++) {
    const block = zoneBlocks[blockIdx]!;
    const base = block.address - ctx.addressBase;
    const isFirst = blockIdx === 0;

    let firstZoneIdx: number;
    let zonesInBlock: number;
    if (isFirst) {
      firstZoneIdx = 0;
      zonesInBlock = Math.min(encoded.length, maxFirst);
    } else {
      firstZoneIdx = maxFirst + (blockIdx - 1) * maxPerLater;
      zonesInBlock = Math.min(Math.max(0, encoded.length - firstZoneIdx), maxPerLater);
    }

    // Preserve header bytes 1–15 on first block when rewriting
    const preservedHeader =
      isFirst && base + 16 <= image.size ? image.bytes.slice(base + 1, base + 16) : null;

    image.bytes.fill(0xff, base, base + DM32_BLOCK_SIZE);

    if (zonesInBlock > 0) {
      const destOffset = isFirst ? DM32_ZONE_START_OFFSET : 0;
      for (let i = 0; i < zonesInBlock; i++) {
        const src = encoded[firstZoneIdx + i]!;
        image.set(base + destOffset + i * DM32_ZONE_ENTRY_SIZE, src);
      }
      // Clear unused zone slots so byte 16 is not left 0xFF (radio treats as count=255).
      const maxSlots = isFirst ? maxFirst : maxPerLater;
      for (let i = zonesInBlock; i < maxSlots; i++) {
        clearDm32ZoneSlot(image, base + destOffset + i * DM32_ZONE_ENTRY_SIZE);
      }
    }

    if (isFirst) {
      image.bytes[base] = zonesInBlock > 0 ? Math.min(zonesInBlock, maxFirst) : 0;
      if (preservedHeader) {
        image.bytes.set(preservedHeader, base + 1);
      }
      const channelCount = options?.channelCount ?? 0;
      sanitizeDm32ZoneBankHeader(image, base, encoded.length, channelCount);
    }

    image.bytes[base + DM32_METADATA_OFFSET] = DM32_METADATA.ZONE;
  }

  return image;
}

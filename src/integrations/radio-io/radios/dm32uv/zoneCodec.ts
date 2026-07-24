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

const TE = new TextEncoder();

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

/**
 * Rewrite all zone blocks (0x5c) from the projection.
 * First block: zones @ offset 16, byte0 = count in first block; later blocks @ 0.
 */
export function encodeZonesIntoDm32Image(
  image: MemoryMap,
  ctx: Dm32ZoneEncodeContext,
  zones: readonly RadioZoneDto[],
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
    }

    if (isFirst) {
      image.bytes[base] = Math.min(Math.max(zonesInBlock, encoded.length === 0 ? 0 : 1), maxFirst);
      if (preservedHeader) {
        image.bytes.set(preservedHeader, base + 1);
      }
      // Terminator after last zone in first contiguous layout when room
      if (encoded.length > 0 && encoded.length <= maxFirst) {
        const termOff = base + DM32_ZONE_START_OFFSET + encoded.length * DM32_ZONE_ENTRY_SIZE;
        if (termOff + 1 < base + DM32_METADATA_OFFSET) {
          image.bytes[termOff] = 0x00;
          image.bytes[termOff + 1] = 0x00;
        }
      }
    }

    image.bytes[base + DM32_METADATA_OFFSET] = DM32_METADATA.ZONE;
  }

  return image;
}

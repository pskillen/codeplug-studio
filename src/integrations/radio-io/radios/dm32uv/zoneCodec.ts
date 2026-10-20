/**
 * DM-32UV zone encode — tags `0x5C` through `0x64` in tag order.
 * Stock and MM9PDY share this writer.
 * Cite: NeonPlug encodeZone + writeZones packing; tier-3 contacts-zones-lists.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioZoneDto } from '../../radioWriteProjection.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';
import { isDm32ZonePageMetadata } from './memory.ts';

export const DM32_ZONE_ENTRY_SIZE = 145;
export const DM32_ZONE_START_OFFSET = 16;
export const DM32_ZONE_MAX_MEMBERS = DM32UV_LIMITS.ZONE_MEMBERS_MAX;

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
  /**
   * Absolute addresses of free pages claimed for a missing zone tag.
   * Replaced on each call. The caller records these on the download cache and
   * must not insert the new tag into sparse blocks before remap.
   */
  claimedAddresses?: number[];
}

interface Dm32ZonePageRef {
  address: number;
  metadata: number;
}

/**
 * Lowest-address discovered block whose metadata is `0x00` or `0xFF`.
 * Compare addresses only; either free byte is eligible.
 *
 * This PR's only caller is the zone encoder, and the only tags it may stamp
 * are `0x5C`–`0x64`. Do not use this to choose a page for any other tag.
 */
export function lowestDm32FreePage(
  discovered: readonly Dm32ZonePageRef[],
  usedAddresses: ReadonlySet<number>,
): Dm32ZonePageRef | undefined {
  let best: Dm32ZonePageRef | undefined;
  for (const block of discovered) {
    if (block.metadata !== DM32_METADATA.EMPTY && block.metadata !== DM32_METADATA.EMPTY_ALT) {
      continue;
    }
    if (usedAddresses.has(block.address)) continue;
    if (!best || block.address < best.address) best = block;
  }
  return best;
}

function nextMissingZoneTag(present: ReadonlySet<number>): number | undefined {
  for (let tag = DM32_METADATA.ZONE_PAGE_FIRST; tag <= DM32_METADATA.ZONE_PAGE_LAST; tag++) {
    if (!present.has(tag)) return tag;
  }
  return undefined;
}

/** One block per zone tag. A repeated tag keeps the lowest address. */
function collectZonePages(discovered: readonly Dm32ZonePageRef[]): Map<number, Dm32ZonePageRef> {
  const byTag = new Map<number, Dm32ZonePageRef>();
  for (const block of discovered) {
    if (!isDm32ZonePageMetadata(block.metadata)) continue;
    const existing = byTag.get(block.metadata);
    if (!existing || block.address < existing.address) {
      byTag.set(block.metadata, block);
    }
  }
  return byTag;
}

function publishClaimedAddresses(
  options: Dm32ZoneEncodeOptions | undefined,
  claimed: readonly number[],
): void {
  if (!options?.claimedAddresses) return;
  options.claimedAddresses.splice(0, options.claimedAddresses.length, ...claimed);
}

/**
 * Rewrite zone pages `0x5C`–`0x64` from the projection, in tag order.
 * The `0x5C` page is the only header page (zones at offset 16, count in byte 0).
 * Later tags pack at offset 0 and keep their own tag.
 * When the projection does not fit, claim the lowest free page for the next
 * missing tag. An empty zone list does not claim a page.
 */
export function encodeZonesIntoDm32Image(
  image: MemoryMap,
  ctx: Dm32ZoneEncodeContext,
  zones: readonly RadioZoneDto[],
  options?: Dm32ZoneEncodeOptions,
): MemoryMap {
  const byTag = collectZonePages(ctx.discovered);
  const usedAddresses = new Set<number>();
  for (const block of byTag.values()) usedAddresses.add(block.address);

  const maxFirst = Math.floor((DM32_BLOCK_SIZE - DM32_ZONE_START_OFFSET) / DM32_ZONE_ENTRY_SIZE);
  const maxPerLater = Math.floor(DM32_BLOCK_SIZE / DM32_ZONE_ENTRY_SIZE);
  const pageCapacity = (tag: number): number =>
    tag === DM32_METADATA.ZONE ? maxFirst : maxPerLater;

  let capacity = 0;
  for (const tag of byTag.keys()) capacity += pageCapacity(tag);

  const claimedAddresses: number[] = [];
  if (zones.length > 0) {
    while (zones.length > capacity) {
      const nextTag = nextMissingZoneTag(new Set(byTag.keys()));
      if (nextTag == null) break;
      // A newly stamped page is unsafe until the operator power-cycles
      // (#1298). The firmware RAM tag table does not learn the page until
      // reboot, and the next on-radio edit can erase it. Studio does not send
      // a reboot command. Claim the lowest free page only, and stamp the next
      // missing zone tag once — never a second 0x5C, never any other tag.
      const free = lowestDm32FreePage(ctx.discovered, usedAddresses);
      if (!free) break;
      byTag.set(nextTag, { address: free.address, metadata: nextTag });
      usedAddresses.add(free.address);
      claimedAddresses.push(free.address);
      capacity += pageCapacity(nextTag);
    }
  }
  publishClaimedAddresses(options, claimedAddresses);

  if (byTag.size === 0) return image;

  const pages = [...byTag.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([tag, block]) => ({ tag, address: block.address }));
  const encoded = zones.map((z) => encodeDm32Zone(z));
  let cursor = 0;

  for (const page of pages) {
    const base = page.address - ctx.addressBase;
    const isHeader = page.tag === DM32_METADATA.ZONE;
    const maxSlots = isHeader ? maxFirst : maxPerLater;
    const zonesInBlock = Math.min(Math.max(0, encoded.length - cursor), maxSlots);

    // Preserve header bytes 1–15 on the 0x5C page only.
    const preservedHeader =
      isHeader && base + 16 <= image.size ? image.bytes.slice(base + 1, base + 16) : null;

    image.bytes.fill(0xff, base, base + DM32_BLOCK_SIZE);

    if (zonesInBlock > 0) {
      const destOffset = isHeader ? DM32_ZONE_START_OFFSET : 0;
      for (let i = 0; i < zonesInBlock; i++) {
        const src = encoded[cursor + i]!;
        image.set(base + destOffset + i * DM32_ZONE_ENTRY_SIZE, src);
      }
      // Clear unused zone slots so byte 16 is not left 0xFF (radio treats as count=255).
      for (let i = zonesInBlock; i < maxSlots; i++) {
        clearDm32ZoneSlot(image, base + destOffset + i * DM32_ZONE_ENTRY_SIZE);
      }
    }

    if (isHeader) {
      image.bytes[base] = zonesInBlock > 0 ? Math.min(zonesInBlock, maxFirst) : 0;
      if (preservedHeader) {
        image.bytes.set(preservedHeader, base + 1);
      }
      const channelCount = options?.channelCount ?? 0;
      sanitizeDm32ZoneBankHeader(image, base, encoded.length, channelCount);
    }

    image.bytes[base + DM32_METADATA_OFFSET] = page.tag;
    cursor += zonesInBlock;
  }

  return image;
}

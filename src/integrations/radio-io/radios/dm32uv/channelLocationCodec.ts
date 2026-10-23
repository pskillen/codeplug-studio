/**
 * MM9PDY DM-32UV channel location pages (storage contract v1).
 *
 * The firmware repo owns this layout: see the "Storage contract v1" comment on
 * pskillen/baofeng-dm32-firmware#71 and `docs/reference/radios/baofeng/dm-32uv/channel-locations.md`.
 *
 * Twelve 4 KiB codeplug pages, tags `70 71 72 73 76 77 78 79 7A 7B 7D 7E`. Page *k* covers
 * memory channels `1 + 339k .. 339(k + 1)`.
 *
 * Page header (16 bytes): magic `MLOC`, version `01`, page index *k*, entry size `0C`,
 * unit (`00` km, `01` miles), first channel `1 + 339k` (u16 LE), `FF` × 6.
 * Then 339 entries of 12 bytes: flags (`01` = position present), `FF`, fingerprint
 * (CRC-16/CCITT-FALSE of the channel record's bytes `+0x00..+0x13` as encoded, LE),
 * latitude and longitude (i32 LE micro-degrees, north and east positive).
 * Entries without a position are left `FF`. The page tag sits at `+0xFFF`.
 *
 * Page placement rules: a live page with the tag is overwritten in place; a second page
 * with the same tag is never created; a page is created only if it holds a position; an
 * existing page is rewritten even when it now holds none, so old entries are cleared.
 */

import type { ChannelDistanceUnit } from '@core/models/radioBuild.ts';
import { geoPointIsUsable } from '@core/domain/channelLocation.ts';
import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { crc16CcittFalse } from '../../kit/checksums.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_CHANNEL_LOCATION,
  DM32_LIMITS,
  DM32_METADATA,
  DM32_METADATA_OFFSET,
} from './constants.ts';
import { dm32ChannelRecordImageOffset, type Dm32ChannelDecodeContext } from './channelCodec.ts';

const FLAG_POSITION_PRESENT = 0x01;

/** Table capacity: 12 × 339 = 4068 slots (more than the 4000 channels the radio holds). */
export const DM32_CHANNEL_LOCATION_CAPACITY =
  DM32_CHANNEL_LOCATION.TAGS.length * DM32_CHANNEL_LOCATION.ENTRIES_PER_PAGE;

export type Dm32ChannelLocationPageMode = 'reuse' | 'claim';

/** A page the upload must write. Recorded on the download cache; checked live before Write. */
export interface Dm32ChannelLocationWritePage {
  address: number;
  tag: number;
  pageIndex: number;
  /** `reuse`: the tag is already live at `address`. `claim`: `address` is a free page. */
  mode: Dm32ChannelLocationPageMode;
}

export interface Dm32ChannelLocationEncodeResult {
  pages: Dm32ChannelLocationWritePage[];
  /** Positions written into pages. */
  positions: number;
  /** Positions dropped because no free page was left for their page tag. */
  unplaced: number;
}

export interface Dm32ChannelLocationEntry {
  fingerprint: number;
  latMicro: number;
  lonMicro: number;
}

export interface Dm32ChannelLocationPage {
  pageIndex: number;
  unit: ChannelDistanceUnit;
  firstChannel: number;
  /** One per channel in the page; `null` when no position is present. */
  entries: (Dm32ChannelLocationEntry | null)[];
}

export function dm32ChannelLocationPageIndexForSlot(slotIndex: number): number {
  return Math.floor((slotIndex - 1) / DM32_CHANNEL_LOCATION.ENTRIES_PER_PAGE);
}

export function isDm32ChannelLocationTag(metadata: number): boolean {
  return (DM32_CHANNEL_LOCATION.TAGS as readonly number[]).includes(metadata);
}

/** CRC-16/CCITT-FALSE over the encoded record's first 20 bytes (name + BCD RX). */
export function dm32ChannelFingerprint(record: Uint8Array): number {
  return crc16CcittFalse(record.subarray(0, DM32_CHANNEL_LOCATION.FINGERPRINT_BYTES));
}

function microDegrees(degrees: number): number {
  return Math.round(degrees * 1_000_000);
}

function isFree(metadata: number | undefined): boolean {
  return metadata === DM32_METADATA.EMPTY || metadata === DM32_METADATA.EMPTY_ALT;
}

/** Encode one 12-byte entry. */
export function encodeDm32ChannelLocationEntry(
  record: Uint8Array,
  location: { lat: number; lon: number },
): Uint8Array {
  const entry = new Uint8Array(DM32_CHANNEL_LOCATION.ENTRY_BYTES);
  const view = new DataView(entry.buffer);
  entry[0] = FLAG_POSITION_PRESENT;
  entry[1] = 0xff;
  view.setUint16(2, dm32ChannelFingerprint(record), true);
  view.setInt32(4, microDegrees(location.lat), true);
  view.setInt32(8, microDegrees(location.lon), true);
  return entry;
}

/** Encode a whole 4 KiB page: header, entries (`FF` when absent), tag at `+0xFFF`. */
export function encodeDm32ChannelLocationPage(
  pageIndex: number,
  unit: ChannelDistanceUnit,
  entries: ReadonlyMap<number, Uint8Array>,
): Uint8Array {
  const page = new Uint8Array(DM32_BLOCK_SIZE).fill(0xff);
  for (let i = 0; i < 4; i++) page[i] = DM32_CHANNEL_LOCATION.MAGIC.charCodeAt(i);
  page[4] = DM32_CHANNEL_LOCATION.VERSION;
  page[5] = pageIndex;
  page[6] = DM32_CHANNEL_LOCATION.ENTRY_BYTES;
  page[7] = unit === 'mi' ? 0x01 : 0x00;
  const first = 1 + DM32_CHANNEL_LOCATION.ENTRIES_PER_PAGE * pageIndex;
  page[8] = first & 0xff;
  page[9] = (first >>> 8) & 0xff;
  for (const [indexInPage, entry] of entries) {
    page.set(
      entry,
      DM32_CHANNEL_LOCATION.HEADER_BYTES + indexInPage * DM32_CHANNEL_LOCATION.ENTRY_BYTES,
    );
  }
  page[DM32_METADATA_OFFSET] = DM32_CHANNEL_LOCATION.TAGS[pageIndex]!;
  return page;
}

/** Decode a page as the firmware would. Bad magic, version, index or entry size → `null`. */
export function decodeDm32ChannelLocationPage(
  page: Uint8Array,
  expectedPageIndex?: number,
): Dm32ChannelLocationPage | null {
  if (page.length < DM32_BLOCK_SIZE) return null;
  if (String.fromCharCode(page[0]!, page[1]!, page[2]!, page[3]!) !== DM32_CHANNEL_LOCATION.MAGIC) {
    return null;
  }
  if (page[4] !== DM32_CHANNEL_LOCATION.VERSION) return null;
  if (page[6] !== DM32_CHANNEL_LOCATION.ENTRY_BYTES) return null;
  const pageIndex = page[5]!;
  if (pageIndex >= DM32_CHANNEL_LOCATION.TAGS.length) return null;
  if (expectedPageIndex !== undefined && pageIndex !== expectedPageIndex) return null;
  if (page[DM32_METADATA_OFFSET] !== DM32_CHANNEL_LOCATION.TAGS[pageIndex]) return null;
  if (page[7] !== 0 && page[7] !== 1) return null;
  const view = new DataView(page.buffer, page.byteOffset, page.byteLength);
  const firstChannel = view.getUint16(8, true);
  if (firstChannel !== 1 + DM32_CHANNEL_LOCATION.ENTRIES_PER_PAGE * pageIndex) return null;
  const entries: (Dm32ChannelLocationEntry | null)[] = [];
  for (let i = 0; i < DM32_CHANNEL_LOCATION.ENTRIES_PER_PAGE; i++) {
    const off = DM32_CHANNEL_LOCATION.HEADER_BYTES + i * DM32_CHANNEL_LOCATION.ENTRY_BYTES;
    if (page[off] !== FLAG_POSITION_PRESENT) {
      entries.push(null);
      continue;
    }
    entries.push({
      fingerprint: view.getUint16(off + 2, true),
      latMicro: view.getInt32(off + 4, true),
      lonMicro: view.getInt32(off + 8, true),
    });
  }
  return { pageIndex, unit: page[7] === 1 ? 'mi' : 'km', firstChannel, entries };
}

function radioChannelHasTablePosition(ch: RadioChannelDto): boolean {
  return !ch.empty && ch.rxHz > 0 && ch.useLocation === true && geoPointIsUsable(ch.location);
}

/** Lowest live address per location tag (boot cleanup keeps the lower page). */
function liveLocationPages(
  discovered: readonly { address: number; metadata: number }[],
): Map<number, number> {
  const byTag = new Map<number, number>();
  for (const block of discovered) {
    if (!isDm32ChannelLocationTag(block.metadata)) continue;
    const existing = byTag.get(block.metadata);
    if (existing === undefined || block.address < existing)
      byTag.set(block.metadata, block.address);
  }
  return byTag;
}

/**
 * Encode the location pages into the write image **after** the channel encode, so the
 * fingerprint is computed from the encoded record bytes.
 *
 * `reservedAddresses` are free pages already claimed this Write (zone claims). They are
 * never chosen for a location page.
 */
export function encodeDm32ChannelLocationPagesIntoImage(
  image: MemoryMap,
  ctx: Dm32ChannelDecodeContext,
  channels: readonly RadioChannelDto[],
  unit: ChannelDistanceUnit,
  reservedAddresses: ReadonlySet<number> = new Set(),
): Dm32ChannelLocationEncodeResult {
  const entriesByPage = new Map<number, Map<number, Uint8Array>>();
  for (const ch of channels) {
    if (!radioChannelHasTablePosition(ch)) continue;
    if (
      ch.slotIndex < 1 ||
      ch.slotIndex > Math.min(DM32_LIMITS.CHANNEL_MAX, DM32_CHANNEL_LOCATION_CAPACITY)
    ) {
      continue;
    }
    const offset = dm32ChannelRecordImageOffset(ctx, ch.slotIndex);
    if (offset === null) continue;
    const record = image.get(offset, DM32_CHANNEL_LOCATION.FINGERPRINT_BYTES);
    const pageIndex = dm32ChannelLocationPageIndexForSlot(ch.slotIndex);
    const indexInPage = (ch.slotIndex - 1) % DM32_CHANNEL_LOCATION.ENTRIES_PER_PAGE;
    const page = entriesByPage.get(pageIndex) ?? new Map<number, Uint8Array>();
    page.set(indexInPage, encodeDm32ChannelLocationEntry(record, ch.location!));
    entriesByPage.set(pageIndex, page);
  }

  const live = liveLocationPages(ctx.discovered);
  const used = new Set<number>(reservedAddresses);
  const pages: Dm32ChannelLocationWritePage[] = [];
  let positions = 0;
  let unplaced = 0;

  for (let pageIndex = 0; pageIndex < DM32_CHANNEL_LOCATION.TAGS.length; pageIndex++) {
    const tag = DM32_CHANNEL_LOCATION.TAGS[pageIndex]!;
    const entries = entriesByPage.get(pageIndex) ?? new Map<number, Uint8Array>();
    const liveAddress = live.get(tag);
    let target: Dm32ChannelLocationWritePage | undefined;
    if (liveAddress !== undefined) {
      // Rewrite in place, even with no positions, so old entries are cleared.
      target = { address: liveAddress, tag, pageIndex, mode: 'reuse' };
    } else if (entries.size > 0) {
      const free = ctx.discovered
        .filter((b) => isFree(b.metadata) && !used.has(b.address))
        .sort((a, b) => a.address - b.address)[0];
      if (free) target = { address: free.address, tag, pageIndex, mode: 'claim' };
    }
    if (!target) {
      unplaced += entries.size;
      continue;
    }
    used.add(target.address);
    const offset = target.address - ctx.addressBase;
    image.set(offset, encodeDm32ChannelLocationPage(pageIndex, unit, entries));
    pages.push(target);
    positions += entries.size;
  }
  return { pages, positions, unplaced };
}

/**
 * Live check before Write, against the metadata scan the upload just made:
 * a reused page must still be the lowest live page with its tag, and a claimed page must
 * still be free while no other page holds the tag. Any change fails the Write; Studio does
 * not search for a substitute.
 */
export function assertDm32ChannelLocationPagesWritable(
  pages: readonly Dm32ChannelLocationWritePage[],
  liveDiscovered: readonly { address: number; metadata: number }[],
): void {
  const seen = new Set<number>();
  for (const page of pages) {
    if (seen.has(page.address)) {
      throw new RadioProtocolError(
        `DM-32UV channel location page 0x${page.address.toString(16)} is staged twice`,
      );
    }
    seen.add(page.address);
    const liveMeta = liveDiscovered.find((b) => b.address === page.address)?.metadata;
    const sameTag = liveDiscovered
      .filter((b) => b.metadata === page.tag)
      .sort((a, b) => a.address - b.address);
    const ok =
      page.mode === 'reuse'
        ? liveMeta === page.tag && sameTag[0]?.address === page.address
        : isFree(liveMeta) && sameTag.length === 0;
    if (!ok) {
      const shown = liveMeta == null ? 'missing' : `0x${liveMeta.toString(16)}`;
      throw new RadioProtocolError(
        `DM-32UV channel location page 0x${page.address.toString(16)} (tag 0x${page.tag.toString(16)}) changed since Read (live metadata ${shown}). Read the radio again before Write.`,
      );
    }
  }
}

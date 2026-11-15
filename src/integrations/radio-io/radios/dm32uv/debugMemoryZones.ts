/**
 * Read-only DM-32UV zone and scan-list inventories projected from a sparse capture.
 *
 * The codecs for these blocks are encode-only, so the decoders live here, written from the tier-3
 * reference (`contacts-zones-lists.md`). Coverage is the bytes captured: an uncaptured page is
 * "not captured", never zero entries. Members are channel slot numbers, resolved against the
 * channel inventory of the same capture and never against names.
 */
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import {
  dm32BlockTag,
  dm32PageAt,
  dm32PagesByTag,
  type Dm32ChannelInventory,
  type Dm32MemberStatus,
  type Dm32MemoryProjection,
  type Dm32SparseCapture,
} from './debugMemory.ts';
import { DM32_SCAN_LIST_ENTRY_SIZE, dm32ScanListEntryOffset } from './scanListCodec.ts';
import { DM32_ZONE_ENTRY_SIZE, DM32_ZONE_START_OFFSET } from './zoneCodec.ts';

/** Records per zone page: `floor((4096 - 16) / 145)` on the first page, `floor(4096 / 145)` after. */
export const DM32_ZONES_PER_PAGE = 28;
const SCAN_MEMBERS_OFFSET = 0x1a;
const SCAN_NAME_LENGTH = 11;
const ZONE_NAME_LENGTH = DM32UV_LIMITS.NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG;

export interface Dm32ResolvedMember {
  /** The raw u16 LE value as stored (a one-based channel slot number). */
  slot: number;
  status: Dm32MemberStatus;
  /** The channel's complete label when resolved. */
  label?: string;
}

export type Dm32ListStatus = 'captured' | 'not-captured' | 'page-order-not-established';

export interface Dm32ZoneHeader {
  /** Raw header bytes: count, channel A, channel B, zone A, zone B (shown raw only). */
  count: number;
  channelA: number;
  channelB: number;
  zoneA: number;
  zoneB: number;
}

export type Dm32ZoneState =
  | {
      kind: 'decoded';
      name: string;
      /** Raw member count byte at record `+16`. */
      memberCountRaw: number;
      /** False when the raw count exceeds the 64-member maximum: no members are read. */
      memberCountValid: boolean;
      members: Dm32ResolvedMember[];
    }
  /** The record is within the stated count but its first name byte is 0x00 or 0xFF. */
  | { kind: 'vacant' }
  | { kind: 'not-captured'; reason: string };

export interface Dm32ZoneEntry {
  /** One-based record position in page order. */
  slot: number;
  state: Dm32ZoneState;
}

export interface Dm32ZoneInventory {
  capacity: number;
  status: Dm32ListStatus;
  reason?: string;
  header?: Dm32ZoneHeader;
  /** Zones the stored count claims above the hardware capacity (not listed). */
  excess: number;
  entries: Dm32ZoneEntry[];
  decoded: number;
  vacant: number;
  notCaptured: number;
}

export type Dm32ScanListState =
  | {
      kind: 'decoded';
      name: string;
      /** Raw `+0x0B` byte: named members + 1 when non-empty. */
      memberCountRaw: number;
      /** Named members: raw - 1 (0 when raw is 0). Undefined when the raw byte is out of range. */
      namedCount?: number;
      members: Dm32ResolvedMember[];
      /** Raw bytes `+0x0C`, `+0x0D`, `+0x0E` and `+0x11..0x12`, hex only: encodings not established. */
      raw: { b0c: number; b0d: number; b0e: number; b11: number; b12: number };
    }
  | { kind: 'vacant' };

export interface Dm32ScanListEntry {
  /** One-based list number; channel records refer to it. */
  slot: number;
  state: Dm32ScanListState;
}

export interface Dm32ScanListInventory {
  capacity: number;
  status: Dm32ListStatus;
  reason?: string;
  declaredCount?: number;
  excess: number;
  entries: Dm32ScanListEntry[];
  decoded: number;
  vacant: number;
}

export interface Dm32MemoryListsProjection extends Dm32MemoryProjection {
  zones: Dm32ZoneInventory;
  scanLists: Dm32ScanListInventory;
}

const u16 = (bytes: Uint8Array, offset: number) => bytes[offset]! | (bytes[offset + 1]! << 8);

/** Bytes up to the first NUL, at most `max` of them. */
function readName(bytes: Uint8Array, max: number): string {
  let end = 0;
  while (end < max && end < bytes.length && bytes[end] !== 0x00) end++;
  return new TextDecoder().decode(bytes.subarray(0, end));
}

/** Resolve one member slot against the channel inventory of the same capture. */
export function resolveDm32Member(
  slot: number,
  channels: Dm32ChannelInventory,
): Dm32ResolvedMember {
  if (slot < 1 || slot > DM32UV_LIMITS.CHANNEL_MAX) return { slot, status: 'out-of-range' };
  if (channels.status !== 'captured') return { slot, status: 'inventory-not-captured' };
  const entry = channels.entries[slot - 1];
  // Beyond the stated channel count: no record was decoded for it.
  if (!entry) return { slot, status: 'not-captured' };
  const state = entry.state;
  if (state.kind === 'not-captured') return { slot, status: 'not-captured' };
  if (state.kind === 'empty' || state.kind === 'blank') return { slot, status: 'empty' };
  if (state.flags.rxInvalidBcd) return { slot, status: 'unreadable' };
  return { slot, status: 'resolved', label: state.channel.wireName || '(unnamed)' };
}

function unavailableZones(status: Dm32ListStatus, reason: string): Dm32ZoneInventory {
  return {
    capacity: DM32UV_LIMITS.ZONE_MAX,
    status,
    reason,
    excess: 0,
    entries: [],
    decoded: 0,
    vacant: 0,
    notCaptured: 0,
  };
}

function decodeZoneRecord(record: Uint8Array, channels: Dm32ChannelInventory): Dm32ZoneState {
  const first = record[0]!;
  if (first === 0x00 || first === 0xff) return { kind: 'vacant' };
  const memberCountRaw = record[16]!;
  const memberCountValid = memberCountRaw <= DM32UV_LIMITS.ZONE_MEMBERS_MAX;
  const members: Dm32ResolvedMember[] = [];
  if (memberCountValid)
    for (let i = 0; i < memberCountRaw; i++)
      members.push(resolveDm32Member(u16(record, 17 + i * 2), channels));
  return {
    kind: 'decoded',
    name: readName(record, ZONE_NAME_LENGTH),
    memberCountRaw,
    memberCountValid,
    members,
  };
}

export function projectDm32Zones(
  capture: Dm32SparseCapture,
  channels: Dm32ChannelInventory,
): Dm32ZoneInventory {
  const order = dm32PagesByTag(
    capture,
    DM32_METADATA.ZONE_PAGE_FIRST,
    DM32_METADATA.ZONE_PAGE_LAST,
  );
  if (!order)
    return unavailableZones(
      'page-order-not-established',
      'Page order not established: this archive has no discovery map (debug/capture.json), and zone pages are never guessed.',
    );
  const first = dm32PageAt(capture, order[0]);
  if (!first)
    return unavailableZones(
      'not-captured',
      order.length === 0
        ? 'The discovery map lists no zone page.'
        : 'The first zone page, which holds the zone count, was not captured.',
    );
  const header: Dm32ZoneHeader = {
    count: first[0]!,
    channelA: first[1]!,
    channelB: first[3]!,
    zoneA: first[5]!,
    zoneB: first[7]!,
  };
  const listed = Math.min(header.count, DM32UV_LIMITS.ZONE_MAX);
  const entries: Dm32ZoneEntry[] = [];
  let decoded = 0;
  let vacant = 0;
  let notCaptured = 0;
  for (let slot = 1; slot <= listed; slot++) {
    const index = slot - 1;
    const pageIndex = Math.floor(index / DM32_ZONES_PER_PAGE);
    const address = order[pageIndex];
    const page = dm32PageAt(capture, address);
    let state: Dm32ZoneState;
    if (!page) {
      notCaptured++;
      state = {
        kind: 'not-captured',
        reason:
          address === undefined
            ? `Zone page ${pageIndex + 1} is not in the discovery map`
            : `Zone page ${pageIndex + 1} was not captured`,
      };
    } else {
      const start =
        (pageIndex === 0 ? DM32_ZONE_START_OFFSET : 0) +
        (index % DM32_ZONES_PER_PAGE) * DM32_ZONE_ENTRY_SIZE;
      state = decodeZoneRecord(page.subarray(start, start + DM32_ZONE_ENTRY_SIZE), channels);
      if (state.kind === 'decoded') decoded++;
      else vacant++;
    }
    entries.push({ slot, state });
  }
  return {
    capacity: DM32UV_LIMITS.ZONE_MAX,
    status: 'captured',
    header,
    excess: Math.max(0, header.count - DM32UV_LIMITS.ZONE_MAX),
    entries,
    decoded,
    vacant,
    notCaptured,
  };
}

/** The single scan-list page. Discovery decides when present; otherwise the stored tag does. */
function scanListPage(capture: Dm32SparseCapture): { page?: Uint8Array; reason?: string } {
  if (capture.discovery) {
    const pages = dm32PagesByTag(capture, DM32_METADATA.SCAN_LIST, DM32_METADATA.SCAN_LIST)!;
    if (pages.length === 0) return { reason: 'The discovery map lists no scan-list page.' };
    const page = dm32PageAt(capture, pages[0]);
    return page ? { page } : { reason: 'The scan-list page was not captured.' };
  }
  for (const block of capture.blocks.values())
    if (dm32BlockTag(block) === DM32_METADATA.SCAN_LIST && block.length === DM32_BLOCK_SIZE)
      return { page: block };
  return { reason: 'No block tagged as the scan-list page was captured.' };
}

function decodeScanListRecord(
  record: Uint8Array,
  channels: Dm32ChannelInventory,
): Dm32ScanListState {
  const first = record[0]!;
  if (first === 0x00 || first === 0xff) return { kind: 'vacant' };
  const memberCountRaw = record[0x0b]!;
  const namedCount =
    memberCountRaw === 0
      ? 0
      : memberCountRaw - 1 <= DM32UV_LIMITS.SCAN_LIST_MEMBERS_MAX
        ? memberCountRaw - 1
        : undefined;
  const members: Dm32ResolvedMember[] = [];
  for (let i = 0; i < (namedCount ?? 0); i++)
    members.push(resolveDm32Member(u16(record, SCAN_MEMBERS_OFFSET + i * 2), channels));
  return {
    kind: 'decoded',
    name: readName(record, SCAN_NAME_LENGTH),
    memberCountRaw,
    namedCount,
    members,
    raw: {
      b0c: record[0x0c]!,
      b0d: record[0x0d]!,
      b0e: record[0x0e]!,
      b11: record[0x11]!,
      b12: record[0x12]!,
    },
  };
}

export function projectDm32ScanLists(
  capture: Dm32SparseCapture,
  channels: Dm32ChannelInventory,
): Dm32ScanListInventory {
  const { page, reason } = scanListPage(capture);
  if (!page)
    return {
      capacity: DM32UV_LIMITS.SCAN_LISTS_MAX,
      status: 'not-captured',
      reason,
      excess: 0,
      entries: [],
      decoded: 0,
      vacant: 0,
    };
  const declaredCount = page[0]!;
  const listed = Math.min(declaredCount, DM32UV_LIMITS.SCAN_LISTS_MAX);
  const entries: Dm32ScanListEntry[] = [];
  let decoded = 0;
  let vacant = 0;
  for (let slot = 1; slot <= listed; slot++) {
    const start = dm32ScanListEntryOffset(slot);
    const state = decodeScanListRecord(
      page.subarray(start, start + DM32_SCAN_LIST_ENTRY_SIZE),
      channels,
    );
    if (state.kind === 'decoded') decoded++;
    else vacant++;
    entries.push({ slot, state });
  }
  return {
    capacity: DM32UV_LIMITS.SCAN_LISTS_MAX,
    status: 'captured',
    declaredCount,
    excess: Math.max(0, declaredCount - DM32UV_LIMITS.SCAN_LISTS_MAX),
    entries,
    decoded,
    vacant,
  };
}

/** Extend the channel projection with zones and scan lists, resolving members against channels. */
export function projectDm32MemoryLists(base: Dm32MemoryProjection): Dm32MemoryListsProjection {
  return {
    ...base,
    zones: projectDm32Zones(base.capture, base.channels),
    scanLists: projectDm32ScanLists(base.capture, base.channels),
  };
}

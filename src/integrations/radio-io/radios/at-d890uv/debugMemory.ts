/**
 * Read-only MR channel and zone inventory projected from recognised AT-D890UV sparse debug entries.
 *
 * Pure: it takes backup-region metadata and the byte records, never a library, build or archive
 * object. Coverage is tracked from the bytes actually captured. The cache decoders fill missing
 * bytes with `0xFF`, so their output is never treated as proof that a span was read.
 */
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { RadioBackupRegionV1 } from '../../backup/types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { listSetBits } from './bitmap.ts';
import { parseAtD890ChannelRecord } from './channelCodec.ts';
import { AT_D890_LIMITS, AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import { classifyAtD890DebugCoverage } from './debugCoverage.ts';
import {
  channelPrimaryAddress,
  channelSecondaryAddress,
  putCacheBytes,
  zoneChannelsAddress,
  zoneNameAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { decodeWideCharName } from './wideChar.ts';
import { listZoneMemberIndicesFromCache } from './zoneCodec.ts';

export interface AtD890RefusedEntry {
  id: string;
  reason: string;
}

interface CapturedPart {
  start: number;
  end: number;
  bytes: Uint8Array;
}

/** Accepted sparse entries, with byte-exact coverage. */
export interface AtD890SparseCapture {
  /** Ids of the entries whose bytes can be read. */
  accepted: readonly string[];
  /** Recognised sparse entries that were refused, with the reason. */
  refused: readonly AtD890RefusedEntry[];
  /** Entries that are not sparse configuration: vital units and anything unrecognised. */
  excluded: { vital: number; unclassified: number };
  /** True only when every byte of `[address, address + length)` was captured. */
  covers(address: number, length: number): boolean;
  /** The captured bytes, or `undefined` when any byte of the span was not captured. */
  read(address: number, length: number): Uint8Array | undefined;
}

/**
 * Accept only recognised AT-D890UV sparse configuration entries whose stored length matches their
 * manifest length and that lie inside the memory map. Duplicate provenance and overlapping entries
 * are ambiguous and are refused whole. Adjacent entries jointly cover a span; gaps stay gaps.
 */
export function buildAtD890SparseCapture(
  regions: readonly RadioBackupRegionV1[],
  bytes: Readonly<Record<string, Uint8Array>>,
): AtD890SparseCapture {
  const classified = classifyAtD890DebugCoverage(regions);
  const vitalRegions = new Set(classified.vital.flatMap((v) => (v.region ? [v.region] : [])));
  const unclassified = new Set(classified.unclassified);
  const candidates = regions.filter((r) => !vitalRegions.has(r) && !unclassified.has(r));

  const refused = new Map<RadioBackupRegionV1, string>();
  const refuse = (region: RadioBackupRegionV1, reason: string) => {
    if (!refused.has(region)) refused.set(region, reason);
  };

  const idCount = new Map<string, number>();
  for (const r of candidates) idCount.set(r.id, (idCount.get(r.id) ?? 0) + 1);
  for (const r of candidates) {
    if (idCount.get(r.id)! > 1) refuse(r, 'The archive lists this entry more than once.');
  }
  for (const r of candidates) {
    if (refused.has(r)) continue;
    const data = bytes[r.id];
    if (!data) refuse(r, 'No stored bytes for this entry.');
    else if (data.length !== r.byteLength)
      refuse(r, `Manifest length ${r.byteLength} does not match the ${data.length} stored bytes.`);
    else if (
      !Number.isSafeInteger(r.address) ||
      !Number.isSafeInteger(r.byteLength) ||
      r.address < 0 ||
      r.address + r.byteLength > AT_D890_MAP_SIZE
    )
      refuse(r, 'The entry lies outside the AT-D890UV memory map.');
  }

  const sound = candidates
    .filter((r) => !refused.has(r))
    .sort((a, b) => a.address - b.address || a.byteLength - b.byteLength);
  // Sweep sorted entries; an entry starting before the furthest end seen so far overlaps.
  let reach = -1;
  let reachOwner: RadioBackupRegionV1 | undefined;
  for (const r of sound) {
    if (reachOwner && r.address < reach) {
      refuse(r, 'The entry overlaps another entry.');
      refuse(reachOwner, 'The entry overlaps another entry.');
    }
    if (r.address + r.byteLength > reach) {
      reach = r.address + r.byteLength;
      reachOwner = r;
    }
  }

  const accepted = sound.filter((r) => !refused.has(r));
  const parts: CapturedPart[] = accepted.map((r) => ({
    start: r.address,
    end: r.address + r.byteLength,
    bytes: bytes[r.id]!,
  }));

  const partIndexAt = (address: number): number => {
    let lo = 0;
    let hi = parts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const part = parts[mid]!;
      if (address < part.start) hi = mid - 1;
      else if (address >= part.end) lo = mid + 1;
      else return mid;
    }
    return -1;
  };

  const read = (address: number, length: number): Uint8Array | undefined => {
    if (length < 0 || address < 0) return undefined;
    const out = new Uint8Array(length);
    let cursor = address;
    const end = address + length;
    while (cursor < end) {
      const index = partIndexAt(cursor);
      if (index < 0) return undefined;
      const part = parts[index]!;
      const take = Math.min(part.end, end) - cursor;
      out.set(
        part.bytes.subarray(cursor - part.start, cursor - part.start + take),
        cursor - address,
      );
      cursor += take;
    }
    return out;
  };

  return {
    accepted: accepted.map((r) => r.id),
    refused: [...refused].map(([r, reason]) => ({ id: r.id, reason })),
    excluded: { vital: vitalRegions.size, unclassified: unclassified.size },
    covers: (address, length) => read(address, length) !== undefined,
    read,
  };
}

export type AtD890BitmapStatus = 'captured' | 'not-captured';

export type AtD890ChannelState =
  /** Both halves captured and the record decodes to a channel. */
  | { kind: 'decoded'; channel: RadioChannelDto }
  /** Both halves captured, but the record has no RX frequency: the bitmap and the record disagree. */
  | { kind: 'empty-record' }
  /** Both halves captured, but the decoder refused the record. */
  | { kind: 'invalid-record'; reason: string }
  /** The bitmap says occupied, but one or both halves were not captured. */
  | { kind: 'not-captured'; primary: boolean; secondary: boolean };

export interface AtD890ChannelEntry {
  /** One-based slot, never renumbered. */
  slot: number;
  state: AtD890ChannelState;
}

export interface AtD890ChannelInventory {
  bitmap: AtD890BitmapStatus;
  /** Hardware slot count. */
  capacity: number;
  /** Occupied bitmap bits inside the hardware range; meaningful only when the bitmap is captured. */
  occupied: number;
  /** Occupied slots that decoded to a channel. */
  decoded: number;
  /** Occupied slots in radio order. Empty when the bitmap was not captured. */
  entries: readonly AtD890ChannelEntry[];
  /** Zero-based bitmap bit numbers set at or above the hardware slot count. */
  outOfRangeBits: readonly number[];
}

export type AtD890MemberStatus =
  'resolved' | 'out-of-range' | 'absent' | 'not-captured' | 'inventory-not-captured' | 'unreadable';

export interface AtD890ZoneMember {
  /** One-based position in the radio's member list. */
  position: number;
  /** The zero-based channel index as stored. */
  rawIndex: number;
  /** `rawIndex + 1`, or `undefined` when the index is beyond the hardware slots. */
  slot: number | undefined;
  status: AtD890MemberStatus;
  channel?: RadioChannelDto;
}

export interface AtD890ZoneEntry {
  /** One-based zone slot. */
  slot: number;
  /** `text` is empty for an unnamed zone. */
  name: { status: 'captured'; text: string } | { status: 'not-captured' };
  members:
    | { status: 'captured'; list: readonly AtD890ZoneMember[]; overCapacity: boolean }
    | { status: 'not-captured' };
}

export interface AtD890ZoneInventory {
  bitmap: AtD890BitmapStatus;
  capacity: number;
  occupied: number;
  entries: readonly AtD890ZoneEntry[];
  outOfRangeBits: readonly number[];
}

export interface AtD890MemoryProjection {
  capture: AtD890SparseCapture;
  channels: AtD890ChannelInventory;
  zones: AtD890ZoneInventory;
}

const FIRST_UNIT_ERASED = 0xffff;

/**
 * A zone name ends at its first NUL code unit, or at erased `0xFFFF` fill: a vacant name field must
 * not decode to replacement characters. Whatever precedes the terminator goes through the shared
 * wide-character decoder.
 */
export function decodeAtD890ZoneName(field: Uint8Array): string {
  let end = field.length - (field.length % 2);
  for (let i = 0; i + 1 < field.length; i += 2) {
    const unit = field[i]! | (field[i + 1]! << 8);
    if (unit === 0 || unit === FIRST_UNIT_ERASED) {
      end = i;
      break;
    }
  }
  return decodeWideCharName(field.subarray(0, end));
}

function readBitmap(
  capture: AtD890SparseCapture,
  address: number,
  length: number,
  capacity: number,
): { status: AtD890BitmapStatus; inRange: number[]; outOfRange: number[] } {
  const raw = capture.read(address, length);
  if (!raw) return { status: 'not-captured', inRange: [], outOfRange: [] };
  const set = listSetBits(raw);
  return {
    status: 'captured',
    inRange: set.filter((bit) => bit < capacity),
    outOfRange: set.filter((bit) => bit >= capacity),
  };
}

function projectChannel(capture: AtD890SparseCapture, index: number): AtD890ChannelState {
  const primary = capture.read(channelPrimaryAddress(index), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE);
  const secondary = capture.read(channelSecondaryAddress(index), AT_D890_LIMITS.CHANNEL_CHUNK_SIZE);
  if (!primary || !secondary)
    return { kind: 'not-captured', primary: !!primary, secondary: !!secondary };
  const record = new Uint8Array(AT_D890_LIMITS.CHANNEL_RECORD_SIZE);
  record.set(primary, 0);
  record.set(secondary, AT_D890_LIMITS.CHANNEL_CHUNK_SIZE);
  try {
    const channel = parseAtD890ChannelRecord(record, index + 1);
    return channel.empty ? { kind: 'empty-record' } : { kind: 'decoded', channel };
  } catch (error) {
    return {
      kind: 'invalid-record',
      reason: error instanceof Error ? error.message : 'Record could not be decoded.',
    };
  }
}

function projectChannels(capture: AtD890SparseCapture): AtD890ChannelInventory {
  const capacity = AT_D890UV_LIMITS.CHANNEL_MAX;
  const bitmap = readBitmap(
    capture,
    D890_MAP.ChannelSet,
    AT_D890_LIMITS.CHANNEL_SET_BYTES,
    capacity,
  );
  const entries = bitmap.inRange.map((index) => ({
    slot: index + 1,
    state: projectChannel(capture, index),
  }));
  return {
    bitmap: bitmap.status,
    capacity,
    occupied: bitmap.inRange.length,
    decoded: entries.filter((e) => e.state.kind === 'decoded').length,
    entries,
    outOfRangeBits: bitmap.outOfRange,
  };
}

function resolveMember(
  rawIndex: number,
  position: number,
  channels: AtD890ChannelInventory,
  bySlot: ReadonlyMap<number, AtD890ChannelEntry>,
): AtD890ZoneMember {
  if (rawIndex >= channels.capacity)
    return { position, rawIndex, slot: undefined, status: 'out-of-range' };
  const slot = rawIndex + 1;
  if (channels.bitmap !== 'captured')
    return { position, rawIndex, slot, status: 'inventory-not-captured' };
  const entry = bySlot.get(slot);
  if (!entry) return { position, rawIndex, slot, status: 'absent' };
  if (entry.state.kind === 'decoded')
    return { position, rawIndex, slot, status: 'resolved', channel: entry.state.channel };
  if (entry.state.kind === 'not-captured')
    return { position, rawIndex, slot, status: 'not-captured' };
  return { position, rawIndex, slot, status: 'unreadable' };
}

function projectZones(
  capture: AtD890SparseCapture,
  channels: AtD890ChannelInventory,
): AtD890ZoneInventory {
  const capacity = AT_D890UV_LIMITS.ZONE_MAX;
  const bitmap = readBitmap(capture, D890_MAP.ZoneSet, AT_D890_LIMITS.ZONE_SET_BYTES, capacity);
  const bySlot = new Map(channels.entries.map((e) => [e.slot, e]));
  const entries = bitmap.inRange.map((index): AtD890ZoneEntry => {
    const nameBytes = capture.read(zoneNameAddress(index), D890_MAP.ZoneDataLength);
    const memberBytes = capture.read(zoneChannelsAddress(index), D890_MAP.ZoneChannelsStride);
    let members: AtD890ZoneEntry['members'] = { status: 'not-captured' };
    if (memberBytes) {
      // The span is verified complete, so the shared decoder sees only captured bytes.
      const cache: AtD890DownloadCache = { blocks: new Map() };
      putCacheBytes(cache, zoneChannelsAddress(index), memberBytes);
      const raw = listZoneMemberIndicesFromCache(cache, index);
      members = {
        status: 'captured',
        list: raw.map((rawIndex, i) => resolveMember(rawIndex, i + 1, channels, bySlot)),
        overCapacity: raw.length > AT_D890UV_LIMITS.ZONE_MEMBERS_MAX,
      };
    }
    return {
      slot: index + 1,
      name: nameBytes
        ? { status: 'captured', text: decodeAtD890ZoneName(nameBytes) }
        : { status: 'not-captured' },
      members,
    };
  });
  return {
    bitmap: bitmap.status,
    capacity,
    occupied: bitmap.inRange.length,
    entries,
    outOfRangeBits: bitmap.outOfRange,
  };
}

/** Project channel and zone inventories from the archive's regions and stored bytes. */
export function projectAtD890Memory(
  regions: readonly RadioBackupRegionV1[],
  bytes: Readonly<Record<string, Uint8Array>>,
): AtD890MemoryProjection {
  const capture = buildAtD890SparseCapture(regions, bytes);
  const channels = projectChannels(capture);
  return { capture, channels, zones: projectZones(capture, channels) };
}

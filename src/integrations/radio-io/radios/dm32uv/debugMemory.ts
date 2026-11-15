/**
 * Read-only DM-32UV memory inventory projected from a debug or backup archive.
 *
 * Pure: it takes the archive's manifest, region bytes and sidecars, never a library, build or
 * transport. Coverage is the bytes captured: a missing page is "not captured", never zero entries
 * and never gap-filled. Page order comes only from the discovery map in `debug/capture.json`.
 */
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { channelOffsetInBank, parseDm32ChannelRecord } from './channelCodec.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_CHANNEL_RECORD_SIZE,
  DM32_METADATA,
  DM32_METADATA_OFFSET,
} from './constants.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';
import {
  classifyDm32DebugCoverage,
  dm32ArchiveWindow,
  DM32_DEBUG_CAPTURE_PATH,
  parseDm32DebugCaptureJson,
  type Dm32DebugCaptureJson,
} from './debugCoverage.ts';
import { getTxContactOffset, parseTxContactEntry } from './txContactCodec.ts';

export interface Dm32RefusedEntry {
  id: string;
  reason: string;
}

/** Accepted whole 4096-byte blocks (tag at `+0xFFF`), with byte-exact coverage. */
export interface Dm32SparseCapture {
  /** Block address to its bytes, ascending. */
  blocks: ReadonlyMap<number, Uint8Array>;
  /** Archive entries the coverage rules refused, with the reason. */
  refused: readonly Dm32RefusedEntry[];
  /** Parsed `debug/capture.json`; absent when none was recorded or it was unusable. */
  discovery?: Dm32DebugCaptureJson;
  block(address: number): Uint8Array | undefined;
  /** True only when every byte of `[address, address + length)` was captured. */
  covers(address: number, length: number): boolean;
}

/** Accepted blocks come from `classifyDm32DebugCoverage`; this adds no second window rule. */
export function buildDm32SparseCapture(archive: Dm32CompareArchive): Dm32SparseCapture {
  const coverage = classifyDm32DebugCoverage(archive.manifest, archive.regions, archive.sidecars);
  const unsorted = new Map<number, Uint8Array>();
  for (const region of coverage.windowRegions) {
    const bytes = archive.regions[region.id];
    if (!bytes) continue;
    for (let offset = 0; offset + DM32_BLOCK_SIZE <= bytes.length; offset += DM32_BLOCK_SIZE)
      unsorted.set(region.address + offset, bytes.subarray(offset, offset + DM32_BLOCK_SIZE));
  }
  const blocks = new Map([...unsorted].sort(([a], [b]) => a - b));
  return {
    blocks,
    refused: coverage.unclassified.map(({ region, reason }) => ({ id: region.id, reason })),
    discovery: parseDm32DebugCaptureJson(
      archive.sidecars[DM32_DEBUG_CAPTURE_PATH],
      dm32ArchiveWindow(archive.manifest),
    ),
    block: (address) => blocks.get(address),
    covers(address, length) {
      if (length <= 0) return false;
      const first = Math.floor(address / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
      for (let a = first; a < address + length; a += DM32_BLOCK_SIZE)
        if (!blocks.has(a)) return false;
      return true;
    },
  };
}

/** How a zone or scan-list member resolves against the decoded channels (used from S3b). */
export type Dm32MemberStatus =
  'resolved' | 'out-of-range' | 'empty' | 'not-captured' | 'inventory-not-captured' | 'unreadable';

/** The tag at `+0xFFF` of a block. */
export const dm32BlockTag = (block: Uint8Array) => block[DM32_METADATA_OFFSET]!;

/**
 * Addresses of the pages whose discovered tag is in `[first, last]`, in tag order (address breaks
 * ties), whether or not each was captured. `undefined` when no discovery map was recorded: page
 * order is then not established.
 */
export function dm32PagesByTag(
  capture: Dm32SparseCapture,
  first: number,
  last: number,
): readonly number[] | undefined {
  if (!capture.discovery) return undefined;
  return capture.discovery.discovered
    .filter((d) => d.tag >= first && d.tag <= last)
    .sort((a, b) => a.tag - b.tag || a.address - b.address)
    .map((d) => d.address);
}

/** Channel pages: tags `0x12` to `0x40`. Tag `0x41` is the VFO bank and is excluded. */
export const dm32ChannelPages = (capture: Dm32SparseCapture) =>
  dm32PagesByTag(capture, DM32_METADATA.CHANNEL_FIRST, DM32_METADATA.CHANNEL_LAST - 1);

/** The page at `address` only when captured and its stored tag agrees with discovery. */
export function dm32PageAt(
  capture: Dm32SparseCapture,
  address: number | undefined,
): Uint8Array | undefined {
  if (address === undefined) return undefined;
  const block = capture.block(address);
  if (!block) return undefined;
  const tag = capture.discovery?.discovered.find((d) => d.address === address)?.tag;
  return tag !== undefined && dm32BlockTag(block) !== tag ? undefined : block;
}

export interface Dm32ChannelFlags {
  /** RX bytes `+0x10..0x13` hold a nibble above 9. */
  rxInvalidBcd: boolean;
  /** TX bytes `+0x14..0x17` hold a nibble above 9 (all `0xFF` is "no TX stored", not invalid). */
  txInvalidBcd: boolean;
  /** TX bytes are all `0xFF`: the decoder reuses RX as TX. */
  noTxStored: boolean;
  /** Raw mode byte `+0x18`; `rxOnly` is partly inferred from it and the band. */
  modeByte: number;
  rxRaw: Uint8Array;
  txRaw: Uint8Array;
}

export type Dm32ChannelState =
  | { kind: 'decoded'; channel: RadioChannelDto; raw: Uint8Array; flags: Dm32ChannelFlags }
  /** All `0xFF`: an erased slot. */
  | { kind: 'empty' }
  /** No name and no RX frequency, but not erased (for example 48 zero bytes). */
  | { kind: 'blank'; raw: Uint8Array }
  | { kind: 'not-captured'; reason: string };

export interface Dm32ChannelEntry {
  /** One-based slot. */
  slot: number;
  state: Dm32ChannelState;
  /** Raw TX-contact talk-group index (12-bit, 0 = none) when its block was captured. */
  txContactIndex?: number;
}

export interface Dm32ChannelInventory {
  capacity: number;
  /** `captured` when the governing count was read; otherwise why not. */
  status: 'captured' | 'not-captured' | 'page-order-not-established';
  reason?: string;
  /** u16 LE at the first channel page `+0x00`, as stored. */
  declaredCount?: number;
  /** Slots the stored count claims above the hardware capacity (not listed). */
  excess: number;
  entries: Dm32ChannelEntry[];
  /** Entries decoded to a record (not empty, blank or not captured). */
  decoded: number;
  empty: number;
  blank: number;
  notCaptured: number;
  /** Whether the TX-contact index blocks (`0x42`/`0x43`) were captured. */
  txContactBlocks: { low: boolean; high: boolean };
}

const isBcd = (bytes: Uint8Array) => bytes.every((b) => (b & 0x0f) <= 9 && b >> 4 <= 9);

function unavailable(
  status: 'not-captured' | 'page-order-not-established',
  reason: string,
): Dm32ChannelInventory {
  return {
    capacity: DM32UV_LIMITS.CHANNEL_MAX,
    status,
    reason,
    excess: 0,
    entries: [],
    decoded: 0,
    empty: 0,
    blank: 0,
    notCaptured: 0,
    txContactBlocks: { low: false, high: false },
  };
}

/** First captured page carrying `tag`. TX-contact pages are looked up by stored tag. */
function firstCapturedByTag(capture: Dm32SparseCapture, tag: number): Uint8Array | undefined {
  for (const block of capture.blocks.values()) if (dm32BlockTag(block) === tag) return block;
  return undefined;
}

/** Decode one fully captured 48-byte record. */
export function decodeDm32ChannelRecord(raw: Uint8Array, slot: number): Dm32ChannelState {
  if (raw.every((b) => b === 0xff)) return { kind: 'empty' };
  const rxRaw = raw.slice(0x10, 0x14);
  const txRaw = raw.slice(0x14, 0x18);
  const noTxStored = txRaw.every((b) => b === 0xff);
  const rxInvalidBcd = !isBcd(rxRaw);
  const txInvalidBcd = !noTxStored && !isBcd(txRaw);
  const channel = parseDm32ChannelRecord(raw, slot);
  if (channel.empty && !rxInvalidBcd) return { kind: 'blank', raw: raw.slice() };
  return {
    kind: 'decoded',
    channel,
    raw: raw.slice(),
    flags: { rxInvalidBcd, txInvalidBcd, noTxStored, modeByte: raw[0x18]!, rxRaw, txRaw },
  };
}

export function projectDm32Channels(capture: Dm32SparseCapture): Dm32ChannelInventory {
  const order = dm32ChannelPages(capture);
  if (!order)
    return unavailable(
      'page-order-not-established',
      'Page order not established: this archive has no discovery map (debug/capture.json), and channel pages are never guessed.',
    );
  const first = dm32PageAt(capture, order[0]);
  if (!first)
    return unavailable(
      'not-captured',
      order.length === 0
        ? 'The discovery map lists no channel page.'
        : 'The first channel page, which holds the channel count, was not captured.',
    );
  const declaredCount = first[0]! | (first[1]! << 8);
  const listed = Math.min(declaredCount, DM32UV_LIMITS.CHANNEL_MAX);
  const lowBlock = firstCapturedByTag(capture, DM32_METADATA.TX_CONTACT_LOW);
  const highBlock = firstCapturedByTag(capture, DM32_METADATA.TX_CONTACT_HIGH);

  const entries: Dm32ChannelEntry[] = [];
  let decoded = 0;
  let empty = 0;
  let blank = 0;
  let notCaptured = 0;
  for (let slot = 1; slot <= listed; slot++) {
    const { blockIndex, offsetInBlock } = channelOffsetInBank(slot);
    const address = order[blockIndex];
    const page = dm32PageAt(capture, address);
    let state: Dm32ChannelState;
    if (!page) {
      notCaptured++;
      state = {
        kind: 'not-captured',
        reason:
          address === undefined
            ? `Channel page ${blockIndex + 1} is not in the discovery map`
            : `Channel page ${blockIndex + 1} was not captured`,
      };
    } else {
      state = decodeDm32ChannelRecord(
        page.subarray(offsetInBlock, offsetInBlock + DM32_CHANNEL_RECORD_SIZE),
        slot,
      );
      if (state.kind === 'decoded') decoded++;
      else if (state.kind === 'empty') empty++;
      else blank++;
    }
    const entry: Dm32ChannelEntry = { slot, state };
    if (state.kind === 'decoded') {
      const { blockMetadata, offset } = getTxContactOffset(slot);
      const bank = blockMetadata === DM32_METADATA.TX_CONTACT_LOW ? lowBlock : highBlock;
      if (bank)
        entry.txContactIndex = parseTxContactEntry(bank[offset]!, bank[offset + 1]!).contactId;
    }
    entries.push(entry);
  }
  return {
    capacity: DM32UV_LIMITS.CHANNEL_MAX,
    status: 'captured',
    declaredCount,
    excess: Math.max(0, declaredCount - DM32UV_LIMITS.CHANNEL_MAX),
    entries,
    decoded,
    empty,
    blank,
    notCaptured,
    txContactBlocks: { low: !!lowBlock, high: !!highBlock },
  };
}

export interface Dm32MemoryProjection {
  capture: Dm32SparseCapture;
  channels: Dm32ChannelInventory;
}

export function projectDm32Memory(capture: Dm32SparseCapture): Dm32MemoryProjection {
  return { capture, channels: projectDm32Channels(capture) };
}

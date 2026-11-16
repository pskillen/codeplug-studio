/**
 * Read-only DM-32UV talk-group, radio-ID and analogue-contact inventories projected from a sparse
 * capture.
 *
 * The codecs for these pages are encode-only, so the decoders live here, written from the tier-3
 * reference (`contacts-zones-lists.md`). Coverage is the bytes captured: a page that was not
 * captured is "not captured", never zero entries. A page is looked up by its stored tag and used
 * only when exactly one accepted block carries it; several are listed and never picked between.
 * Callsign data is unavailable: the digital address book (V-frame `0x0F`) is not captured.
 */
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET, DM32_OFFSET } from './constants.ts';
import { dm32BlockTag, type Dm32SparseCapture } from './debugMemory.ts';
import { DM32_DMR_RADIO_ID_ENTRY_SIZE } from './radioIdCodec.ts';
import { CALL_TYPE_ALL, CALL_TYPE_GROUP, CALL_TYPE_PRIVATE } from './talkGroupCodec.ts';

/** Talk-group entry: flag, 16-byte name, NUL, 3-byte LE ID, call type, two reserved bytes. */
export const DM32_TALK_GROUP_ENTRY_SIZE = 24;
/** The first entry is preceded by one `0x00` header byte. */
export const DM32_TALK_GROUP_HEADER = 1;
const TALK_GROUP_NAME_LENGTH = 16;
/** Entries that fit the one `0x44` page; the tag byte at `+0xFFF` is not entry space. */
export const DM32_TALK_GROUPS_PER_PAGE = Math.floor(
  (DM32_METADATA_OFFSET - DM32_TALK_GROUP_HEADER) / DM32_TALK_GROUP_ENTRY_SIZE,
);
/** Tags `0x45` to `0x48` are captured raw; their payload layout is not established. */
export const DM32_TALK_GROUP_OVERFLOW_TAGS = [0x45, 0x46, 0x47, 0x48] as const;

const RADIO_ID_FIRST_ENTRY = 0x10;
const RADIO_ID_NAME_LENGTH = 12;

export const DM32_ANALOG_CONTACT_SIZE = 32;
const ANALOG_CONTACT_FIRST = 0x200;
/** Whole records that fit in the page after `+0x200`. */
export const DM32_ANALOG_CONTACTS_PER_PAGE = Math.floor(
  (DM32_METADATA_OFFSET - ANALOG_CONTACT_FIRST) / DM32_ANALOG_CONTACT_SIZE,
);

export type Dm32PageLookup =
  | { kind: 'page'; page: Uint8Array; address: number }
  | { kind: 'none' }
  | { kind: 'several'; addresses: number[] };

/** The single accepted block stored with `tag`; several are reported, none means not captured. */
export function dm32PageByStoredTag(capture: Dm32SparseCapture, tag: number): Dm32PageLookup {
  const found: { page: Uint8Array; address: number }[] = [];
  for (const [address, page] of capture.blocks)
    if (page.length === DM32_BLOCK_SIZE && dm32BlockTag(page) === tag)
      found.push({ page, address });
  if (found.length === 0) return { kind: 'none' };
  if (found.length > 1) return { kind: 'several', addresses: found.map((f) => f.address) };
  return { kind: 'page', ...found[0]! };
}

export type Dm32ListStatus =
  | 'captured'
  | 'not-captured'
  /** Several accepted pages carry the tag: none is decoded. */
  | 'ambiguous';

const u24 = (bytes: Uint8Array, offset: number) =>
  bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);

/** Bytes up to the first NUL, at most `max` of them. */
function readName(bytes: Uint8Array, max: number): string {
  let end = 0;
  while (end < max && end < bytes.length && bytes[end] !== 0x00) end++;
  return new TextDecoder().decode(bytes.subarray(0, end));
}

const isVacant = (bytes: Uint8Array) =>
  bytes.every((b) => b === 0x00) || bytes.every((b) => b === 0xff);

export const dm32TagHex = (tag: number) => `0x${tag.toString(16).toUpperCase().padStart(2, '0')}`;

function unavailableFor(lookup: Dm32PageLookup, tag: number) {
  if (lookup.kind === 'several')
    return {
      status: 'ambiguous' as const,
      reason: `Several pages tagged ${dm32TagHex(tag)}, not decoded.`,
    };
  return {
    status: 'not-captured' as const,
    reason: `No accepted block tagged ${dm32TagHex(tag)} was captured.`,
  };
}

// ---------------------------------------------------------------------------------------------
// Talk groups

export type Dm32CallType = 'private' | 'group' | 'all' | 'unknown';

export interface Dm32TalkGroupEntry {
  /** One-based position in the stored list: channel TX contacts refer to it. */
  slot: number;
  name: string;
  /** The DMR ID as stored (3-byte little-endian). */
  dmrId: number;
  callType: Dm32CallType;
  /** The raw call-type byte. */
  callTypeRaw: number;
  /** The raw flag byte before the name. */
  flag: number;
}

export interface Dm32OverflowPage {
  tag: number;
  /** Addresses of accepted blocks stored with this tag. */
  addresses: number[];
  /** Listed by the discovery map but not captured. */
  discoveredNotCaptured: boolean;
}

export interface Dm32TalkGroupInventory {
  capacity: number;
  status: Dm32ListStatus;
  reason?: string;
  entries: Dm32TalkGroupEntry[];
  /** Entries decoded from the `0x44` page. */
  decoded: number;
  /** u16 LE at the quick-access page `+0x00`; undefined when that page was not usable. */
  storedCount?: number;
  quickAccess: 'captured' | 'not-captured' | 'ambiguous';
  /** True when the stored count and the decoded count differ. */
  countMismatch: boolean;
  /** Stored count above the 800-entry hardware capacity. */
  excess: number;
  /** Tags `0x45`-`0x48`: present or not, layout never decoded. */
  overflow: Dm32OverflowPage[];
  /** Entries one page holds; the list is never called complete while tags `0x45`-`0x48` exist. */
  pageCapacity: number;
}

export function callTypeOf(raw: number): Dm32CallType {
  if (raw === CALL_TYPE_PRIVATE) return 'private';
  if (raw === CALL_TYPE_GROUP) return 'group';
  if (raw === CALL_TYPE_ALL) return 'all';
  return 'unknown';
}

/** Decode the packed `0x44` page: stride 24 after the single header byte, until a vacant entry. */
export function decodeDm32TalkGroupPage(page: Uint8Array): Dm32TalkGroupEntry[] {
  const entries: Dm32TalkGroupEntry[] = [];
  for (let i = 0; i < DM32_TALK_GROUPS_PER_PAGE; i++) {
    const start = DM32_TALK_GROUP_HEADER + i * DM32_TALK_GROUP_ENTRY_SIZE;
    const raw = page.subarray(start, start + DM32_TALK_GROUP_ENTRY_SIZE);
    if (isVacant(raw)) break;
    const callTypeRaw = raw[21]!;
    entries.push({
      slot: i + 1,
      name: readName(raw.subarray(1), TALK_GROUP_NAME_LENGTH),
      dmrId: u24(raw, 18),
      callType: callTypeOf(callTypeRaw),
      callTypeRaw,
      flag: raw[0]!,
    });
  }
  return entries;
}

export function projectDm32TalkGroups(capture: Dm32SparseCapture): Dm32TalkGroupInventory {
  const overflow: Dm32OverflowPage[] = DM32_TALK_GROUP_OVERFLOW_TAGS.map((tag) => {
    const addresses = [...capture.blocks]
      .filter(([, b]) => b.length === DM32_BLOCK_SIZE && dm32BlockTag(b) === tag)
      .map(([a]) => a);
    return {
      tag,
      addresses,
      discoveredNotCaptured:
        addresses.length === 0 && !!capture.discovery?.discovered.some((d) => d.tag === tag),
    };
  });
  const quick = dm32PageByStoredTag(capture, DM32_METADATA.METADATA_0x0B);
  const storedCount = quick.kind === 'page' ? quick.page[0]! | (quick.page[1]! << 8) : undefined;
  const base = {
    capacity: DM32UV_LIMITS.TALK_GROUPS_MAX,
    pageCapacity: DM32_TALK_GROUPS_PER_PAGE,
    overflow,
    quickAccess:
      quick.kind === 'page'
        ? ('captured' as const)
        : quick.kind === 'several'
          ? ('ambiguous' as const)
          : ('not-captured' as const),
    storedCount,
    excess: Math.max(0, (storedCount ?? 0) - DM32UV_LIMITS.TALK_GROUPS_MAX),
  };
  const lookup = dm32PageByStoredTag(capture, DM32_METADATA.TALK_GROUPS);
  if (lookup.kind !== 'page') {
    const u = unavailableFor(lookup, DM32_METADATA.TALK_GROUPS);
    return { ...base, ...u, entries: [], decoded: 0, countMismatch: false };
  }
  const entries = decodeDm32TalkGroupPage(lookup.page);
  return {
    ...base,
    status: 'captured',
    entries,
    decoded: entries.length,
    countMismatch: storedCount !== undefined && storedCount !== entries.length,
  };
}

// ---------------------------------------------------------------------------------------------
// Radio IDs

export interface Dm32RadioIdEntry {
  /** One-based; channel records refer to it zero-based (slot - 1). */
  slot: number;
  dmrId: number;
  name: string;
}

export interface Dm32RadioIdInventory {
  capacity: number;
  status: Dm32ListStatus;
  reason?: string;
  /** The count byte at `+0x00` as stored. */
  declaredCount?: number;
  /** Entries the stored count claims above the hardware capacity (not listed). */
  excess: number;
  entries: Dm32RadioIdEntry[];
  decoded: number;
  /** Listed positions whose 16 bytes are all `0x00` or all `0xFF`. */
  vacant: number;
}

export function projectDm32RadioIds(capture: Dm32SparseCapture): Dm32RadioIdInventory {
  const lookup = dm32PageByStoredTag(capture, DM32_METADATA.DMR_RADIO_IDS);
  const capacity = DM32UV_LIMITS.RADIO_IDS_MAX;
  if (lookup.kind !== 'page') {
    const u = unavailableFor(lookup, DM32_METADATA.DMR_RADIO_IDS);
    return { capacity, ...u, excess: 0, entries: [], decoded: 0, vacant: 0 };
  }
  const declaredCount = lookup.page[0]!;
  const listed = Math.min(declaredCount, capacity);
  const entries: Dm32RadioIdEntry[] = [];
  let vacant = 0;
  for (let slot = 1; slot <= listed; slot++) {
    const start = RADIO_ID_FIRST_ENTRY + (slot - 1) * DM32_DMR_RADIO_ID_ENTRY_SIZE;
    const raw = lookup.page.subarray(start, start + DM32_DMR_RADIO_ID_ENTRY_SIZE);
    if (isVacant(raw)) {
      vacant++;
      continue;
    }
    entries.push({
      slot,
      dmrId: u24(raw, 0),
      name: readName(raw.subarray(3), RADIO_ID_NAME_LENGTH),
    });
  }
  return {
    capacity,
    status: 'captured',
    declaredCount,
    excess: Math.max(0, declaredCount - capacity),
    entries,
    decoded: entries.length,
    vacant,
  };
}

// ---------------------------------------------------------------------------------------------
// Analogue contacts (raw)

export interface Dm32AnalogContactRecord {
  /** One-based record position. */
  slot: number;
  raw: Uint8Array;
}

export interface Dm32AnalogContactInventory {
  status: Dm32ListStatus;
  reason?: string;
  /** The count byte at page `+0x1FF` as stored. */
  declaredCount?: number;
  /** Records the stored count claims beyond what the page can hold (not captured). */
  beyondPage: number;
  records: Dm32AnalogContactRecord[];
}

export function projectDm32AnalogContacts(capture: Dm32SparseCapture): Dm32AnalogContactInventory {
  const lookup = dm32PageByStoredTag(capture, DM32_METADATA.ANALOG_CONTACTS);
  if (lookup.kind !== 'page') {
    const u = unavailableFor(lookup, DM32_METADATA.ANALOG_CONTACTS);
    return { ...u, beyondPage: 0, records: [] };
  }
  const declaredCount = lookup.page[DM32_OFFSET.ANALOG_CONTACT_COUNT]!;
  const listed = Math.min(declaredCount, DM32_ANALOG_CONTACTS_PER_PAGE);
  const records: Dm32AnalogContactRecord[] = [];
  for (let slot = 1; slot <= listed; slot++) {
    const start = ANALOG_CONTACT_FIRST + (slot - 1) * DM32_ANALOG_CONTACT_SIZE;
    records.push({ slot, raw: lookup.page.slice(start, start + DM32_ANALOG_CONTACT_SIZE) });
  }
  return {
    status: 'captured',
    declaredCount,
    beyondPage: Math.max(0, declaredCount - DM32_ANALOG_CONTACTS_PER_PAGE),
    records,
  };
}

export interface Dm32ListsProjection {
  talkGroups: Dm32TalkGroupInventory;
  radioIds: Dm32RadioIdInventory;
  analogContacts: Dm32AnalogContactInventory;
}

export function projectDm32Lists(capture: Dm32SparseCapture): Dm32ListsProjection {
  return {
    talkGroups: projectDm32TalkGroups(capture),
    radioIds: projectDm32RadioIds(capture),
    analogContacts: projectDm32AnalogContacts(capture),
  };
}

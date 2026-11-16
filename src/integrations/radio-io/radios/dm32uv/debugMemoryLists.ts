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
import { dm32BlockTag, type Dm32ChannelInventory, type Dm32SparseCapture } from './debugMemory.ts';
import { DM32_DMR_RADIO_ID_ENTRY_SIZE } from './radioIdCodec.ts';
import {
  decodeDm32RxGroupTimeSlotOverrides,
  DM32_RX_GROUP_ENTRY_SIZE,
  DM32_RX_SLOT_CHECK_BASE_OFFSET,
  DM32_RX_SLOT_MARKER,
  DM32_RX_SLOT_MARKER_OFFSET,
  rxGroupSlotCheck,
} from './rxGroupCodec.ts';
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

// ---------------------------------------------------------------------------------------------
// RX groups

const RX_GROUP_FIRST_ENTRY = 0x11;
const RX_GROUP_NAME_LENGTH = 11;
const RX_MEMBERS_OFFSET = 0x0b;

/** How an RX-group member's DMR ID relates to the decoded talk groups. */
export type Dm32RxMemberMatch =
  | { kind: 'matched'; talkGroupSlot: number; name: string }
  /** No decoded talk group carries the ID (the decoded list is one page and not complete). */
  | { kind: 'none' }
  | { kind: 'several'; count: number }
  | { kind: 'talk-groups-unavailable' };

export interface Dm32RxGroupMember {
  /** One-based position among the 32 stored member positions. */
  position: number;
  /** All-zero or all-`0xFF` position. */
  empty: boolean;
  /** The 3-byte LE DMR ID as stored; a DMR ID on the wire, not a foreign key. */
  dmrId?: number;
  /** Time-slot override, only from a valid store. */
  timeSlot?: 1 | 2;
  match?: Dm32RxMemberMatch;
}

/** The per-member time-slot store at the page tail: marker and per-group check. */
export type Dm32RxTimeSlotStore = 'valid' | 'no-marker' | 'check-failed';

export interface Dm32RxGroupEntry {
  /** One-based group slot: bit `slot - 1` of the bitmask. */
  slot: number;
  name: string;
  /** The 109-byte entry is all `0xFF` or all `0x00` although its bit is set. */
  blank: boolean;
  /** Stored order and duplicates kept; empty positions included. */
  members: Dm32RxGroupMember[];
  occupiedMembers: number;
  timeSlotStore: Dm32RxTimeSlotStore;
}

export interface Dm32RxGroupInventory {
  capacity: number;
  status: Dm32ListStatus;
  reason?: string;
  /** The u32 LE bitmask at `+0x00` as stored. */
  bitmask?: number;
  /** Bits set at or above the capacity; reported, never listed. */
  bitsAboveCapacity: number;
  /** One-based slots whose bit is set, ascending. */
  occupiedSlots: number[];
  entries: Dm32RxGroupEntry[];
  decoded: number;
}

function matchMember(dmrId: number, talkGroups: Dm32TalkGroupInventory): Dm32RxMemberMatch {
  if (talkGroups.status !== 'captured') return { kind: 'talk-groups-unavailable' };
  const hits = talkGroups.entries.filter((t) => t.dmrId === dmrId);
  if (hits.length === 0) return { kind: 'none' };
  if (hits.length > 1) return { kind: 'several', count: hits.length };
  return { kind: 'matched', talkGroupSlot: hits[0]!.slot, name: hits[0]!.name };
}

function timeSlotStoreOf(page: Uint8Array, group: number): Dm32RxTimeSlotStore {
  const marked = DM32_RX_SLOT_MARKER.every((b, i) => page[DM32_RX_SLOT_MARKER_OFFSET + i] === b);
  if (!marked) return 'no-marker';
  return page[DM32_RX_SLOT_CHECK_BASE_OFFSET + group - 1] === rxGroupSlotCheck(page, group - 1)
    ? 'valid'
    : 'check-failed';
}

export function projectDm32RxGroups(
  capture: Dm32SparseCapture,
  talkGroups: Dm32TalkGroupInventory,
): Dm32RxGroupInventory {
  const capacity = DM32UV_LIMITS.RX_GROUPS_MAX;
  const lookup = dm32PageByStoredTag(capture, DM32_METADATA.RX_GROUPS);
  if (lookup.kind !== 'page') {
    const u = unavailableFor(lookup, DM32_METADATA.RX_GROUPS);
    return { capacity, ...u, bitsAboveCapacity: 0, occupiedSlots: [], entries: [], decoded: 0 };
  }
  const { page } = lookup;
  const bitmask = (page[0]! | (page[1]! << 8) | (page[2]! << 16) | (page[3]! << 24)) >>> 0;
  const occupiedSlots: number[] = [];
  let bitsAboveCapacity = 0;
  for (let bit = 0; bit < 32; bit++) {
    if (((bitmask >>> bit) & 1) === 0) continue;
    if (bit < capacity) occupiedSlots.push(bit + 1);
    else bitsAboveCapacity++;
  }
  const entries: Dm32RxGroupEntry[] = occupiedSlots.map((slot) => {
    const start = RX_GROUP_FIRST_ENTRY + (slot - 1) * DM32_RX_GROUP_ENTRY_SIZE;
    const raw = page.subarray(start, start + DM32_RX_GROUP_ENTRY_SIZE);
    const blank = isVacant(raw);
    const store = timeSlotStoreOf(page, slot);
    const overrides =
      store === 'valid' ? decodeDm32RxGroupTimeSlotOverrides(page, slot) : undefined;
    const members: Dm32RxGroupMember[] = blank
      ? []
      : Array.from({ length: DM32UV_LIMITS.RX_GROUP_MEMBERS_MAX }, (_, i) => {
          const bytes = raw.subarray(RX_MEMBERS_OFFSET + i * 3, RX_MEMBERS_OFFSET + i * 3 + 3);
          const position = i + 1;
          if (isVacant(bytes)) return { position, empty: true };
          const dmrId = u24(bytes, 0);
          const timeSlot = overrides?.[i];
          return {
            position,
            empty: false,
            dmrId,
            ...(timeSlot ? { timeSlot } : {}),
            match: matchMember(dmrId, talkGroups),
          };
        });
    return {
      slot,
      name: blank ? '' : readName(raw, RX_GROUP_NAME_LENGTH),
      blank,
      members,
      occupiedMembers: members.filter((m) => !m.empty).length,
      timeSlotStore: store,
    };
  });
  return {
    capacity,
    status: 'captured',
    bitmask,
    bitsAboveCapacity,
    occupiedSlots,
    entries,
    decoded: entries.length,
  };
}

// ---------------------------------------------------------------------------------------------
// Channel references

export type Dm32ReferenceStatus =
  /** The channel stores no reference (0 or `0xFF`). */
  | 'none'
  | 'resolved'
  /** The stored value exceeds the hardware capacity of the target list. */
  | 'out-of-range'
  /** Within capacity but the target record is not present in the captured list. */
  | 'absent'
  /** Within capacity but beyond the decoded entries (talk-group overflow pages are not decoded). */
  | 'not-decoded'
  /** The target list was not captured (or is ambiguous). */
  | 'inventory-not-captured'
  /** The channel's own reference bytes were not captured. */
  | 'not-captured';

export interface Dm32Reference {
  /** The stored value, when captured. */
  raw?: number;
  status: Dm32ReferenceStatus;
  /** Target name when resolved. */
  label?: string;
  /** Target slot when resolved. */
  targetSlot?: number;
  note?: string;
}

export interface Dm32ChannelReferences {
  /** One-based position in the talk-group list; resolved by position, never by DMR ID. */
  txContact: Dm32Reference;
  /** Zero-based index into the radio-ID bank (`0xFF` none). Digital channels only. */
  radioId?: Dm32Reference;
  /** Channel byte `+0x1F` bits 5-0; slot n assumed 1-based, not verified on hardware. */
  rxGroup?: Dm32Reference;
}

export interface Dm32TalkGroupReferences {
  channels: { slot: number; label: string }[];
  rxGroups: { slot: number; name: string }[];
}

export interface Dm32ReferenceResolution {
  byChannel: ReadonlyMap<number, Dm32ChannelReferences>;
  /** Keyed by talk-group slot. */
  referencedBy: ReadonlyMap<number, Dm32TalkGroupReferences>;
  /** Why "Referenced by" cannot be complete; empty when every source was captured. */
  partialReasons: string[];
}

function resolveTxContact(raw: number | undefined, tg: Dm32TalkGroupInventory): Dm32Reference {
  if (raw === undefined) return { status: 'not-captured' };
  if (raw === 0) return { raw, status: 'none' };
  if (tg.status !== 'captured') return { raw, status: 'inventory-not-captured' };
  if (raw > tg.capacity) return { raw, status: 'out-of-range' };
  const entry = tg.entries[raw - 1];
  if (entry) return { raw, status: 'resolved', label: entry.name || '(unnamed)', targetSlot: raw };
  if (tg.storedCount !== undefined && raw > tg.storedCount)
    return { raw, status: 'absent', note: 'beyond the stored talk-group count' };
  return { raw, status: 'not-decoded', note: 'beyond the decoded first talk-group page' };
}

function resolveRadioId(raw: number, ids: Dm32RadioIdInventory): Dm32Reference {
  if (raw === 0xff) return { raw, status: 'none' };
  if (ids.status !== 'captured') return { raw, status: 'inventory-not-captured' };
  if (raw >= ids.capacity) return { raw, status: 'out-of-range' };
  const entry = ids.entries.find((e) => e.slot === raw + 1);
  if (entry)
    return {
      raw,
      status: 'resolved',
      label: `${entry.name || '(unnamed)'} (${entry.dmrId})`,
      targetSlot: entry.slot,
    };
  return {
    raw,
    status: 'absent',
    note: raw + 1 > (ids.declaredCount ?? 0) ? 'beyond the stated count' : 'vacant position',
  };
}

function resolveRxGroup(raw: number, groups: Dm32RxGroupInventory): Dm32Reference {
  if (raw === 0) return { raw, status: 'none', note: 'assumed' };
  if (groups.status !== 'captured') return { raw, status: 'inventory-not-captured' };
  if (raw > groups.capacity) return { raw, status: 'out-of-range' };
  const entry = groups.entries.find((g) => g.slot === raw);
  if (entry)
    return {
      raw,
      status: 'resolved',
      label: entry.name || '(unnamed)',
      targetSlot: raw,
      note: 'assumed 1-based; not verified on hardware',
    };
  return { raw, status: 'absent', note: 'its bit is not set' };
}

/**
 * Resolve each decoded channel's TX contact, radio ID and RX group against the lists of the same
 * capture, and invert the TX-contact and RX-member references into "Referenced by" for talk
 * groups. RX group members count only when exactly one decoded talk group carries the DMR ID.
 */
export function resolveDm32ChannelReferences(
  channels: Dm32ChannelInventory,
  lists: Dm32ListsProjection,
): Dm32ReferenceResolution {
  const byChannel = new Map<number, Dm32ChannelReferences>();
  const referencedBy = new Map<number, Dm32TalkGroupReferences>();
  const bucket = (slot: number) => {
    let b = referencedBy.get(slot);
    if (!b) referencedBy.set(slot, (b = { channels: [], rxGroups: [] }));
    return b;
  };
  for (const entry of channels.entries) {
    if (entry.state.kind !== 'decoded') continue;
    const { channel, raw } = entry.state;
    const txContact = resolveTxContact(entry.txContactIndex, lists.talkGroups);
    const refs: Dm32ChannelReferences = { txContact };
    if (channel.mode !== undefined && channel.mode !== 'analog') {
      refs.radioId = resolveRadioId(raw[0x2b]!, lists.radioIds);
      refs.rxGroup = resolveRxGroup(raw[0x1f]! & 0x3f, lists.rxGroups);
    }
    byChannel.set(entry.slot, refs);
    if (txContact.status === 'resolved')
      bucket(txContact.targetSlot!).channels.push({
        slot: entry.slot,
        label: channel.wireName || '(unnamed)',
      });
  }
  for (const group of lists.rxGroups.entries)
    for (const member of group.members)
      if (member.match?.kind === 'matched') {
        const rxGroups = bucket(member.match.talkGroupSlot).rxGroups;
        if (!rxGroups.some((g) => g.slot === group.slot))
          rxGroups.push({ slot: group.slot, name: group.name || '(unnamed)' });
      }

  const partialReasons: string[] = [];
  if (channels.status !== 'captured') partialReasons.push('channels were not captured');
  else {
    if (channels.notCaptured > 0)
      partialReasons.push(`${channels.notCaptured} channel records were not captured`);
    if (channels.excess > 0)
      partialReasons.push('channels above the hardware capacity are not listed');
    if (!channels.txContactBlocks.low || !channels.txContactBlocks.high)
      partialReasons.push('some TX contact pages were not captured');
  }
  if (lists.rxGroups.status !== 'captured') partialReasons.push('RX groups were not captured');
  return { byChannel, referencedBy, partialReasons };
}

export interface Dm32ListsProjection {
  talkGroups: Dm32TalkGroupInventory;
  rxGroups: Dm32RxGroupInventory;
  radioIds: Dm32RadioIdInventory;
  analogContacts: Dm32AnalogContactInventory;
}

export function projectDm32Lists(capture: Dm32SparseCapture): Dm32ListsProjection {
  const talkGroups = projectDm32TalkGroups(capture);
  return {
    talkGroups,
    rxGroups: projectDm32RxGroups(capture, talkGroups),
    radioIds: projectDm32RadioIds(capture),
    analogContacts: projectDm32AnalogContacts(capture),
  };
}

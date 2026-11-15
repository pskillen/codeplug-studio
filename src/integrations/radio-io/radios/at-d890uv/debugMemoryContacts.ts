/**
 * Read-only AT-D890UV contact / talk-group bank and RX-group inventory for the debug Memory viewer.
 *
 * Pure: it reads through a coverage-aware reader and never takes a library, build or archive
 * object. The cache decoders fill missing bytes with `0xFF` and the clone-summary helpers omit
 * unnamed rows, so neither can establish coverage; everything here is decoded from bytes that
 * were verified captured. The separate `DigitalContact*` ID database is outside the accepted
 * configuration map and is not read.
 *
 * The shared bank holds private-call (`0`), group-call (`1`) and all-call (`2`) records in one
 * 10,000-slot space, addressed by a zero-based index and shown one-based. A record is classified
 * only when its complete `0xC8` span is captured and its fields are valid; anything else stays
 * listed as an explicitly unclassified entry rather than becoming an empty contact or talk group.
 */
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { listSetBits } from './bitmap.ts';
import { decodeBcdAsHexU32 } from './bcd.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { receiveGroupAddress, talkgroupAddress } from './memory.ts';
import { decodeAtD890RxGroupTimeSlotOverrides } from './rxGroupCodec.ts';
import { decodeWideCharName } from './wideChar.ts';

/** The part of a sparse capture this module needs; satisfied by `AtD890SparseCapture`. */
export interface AtD890ByteReader {
  read(address: number, length: number): Uint8Array | undefined;
}

export type AtD890BankBitmapStatus = 'captured' | 'not-captured';

export type AtD890CallType = 0 | 1 | 2;

/** CPS record offsets, see `docs/reference/radios/anytone/at-d890uv/talkgroup-record.md`. */
const NAME_OFFSET = 0x06;
const NAME_BYTES = 0x20;
const CITY_OFFSET = 0x2a;
const CITY_BYTES = 0x20;
const CALLSIGN_OFFSET = 0x4a;
const CALLSIGN_BYTES = 0x18;
const STATE_OFFSET = 0x62;
const STATE_BYTES = 0x22;
const COUNTRY_OFFSET = 0x84;
const COUNTRY_BYTES = 0x22;
const REMARK_OFFSET = 0xa6;
const REMARK_BYTES = 0x22;

const RX_NAME_OFFSET = 0x100;
const RX_NAME_BYTES = 0x20;
const RX_MEMBER_BYTES = 0x100;
const RX_TAIL_OFFSET = 0x120;
const RX_EMPTY_MEMBER = 0xffff_ffff;

export interface AtD890BankRecord {
  /** One-based slot, never renumbered. */
  slot: number;
  callType: AtD890CallType;
  dmrId: number;
  /** Empty when the record has no name. */
  name: string;
  callsign: string;
  city: string;
  state: string;
  country: string;
  remark: string;
}

export type AtD890BankState =
  /** Complete record with a known call type and a valid BCD DMR ID. */
  | { kind: 'decoded'; record: AtD890BankRecord }
  /** Complete record whose call type byte is not 0, 1 or 2. */
  | { kind: 'unknown-type'; rawCallType: number; name: string }
  /** Complete record whose DMR ID bytes are not decimal BCD. */
  | { kind: 'malformed'; rawCallType: number; reason: string; name: string }
  /** The bank bitmap marks the slot occupied but its `0xC8` span was not completely captured. */
  | { kind: 'not-captured' };

export interface AtD890BankEntry {
  /** One-based slot, never renumbered by filtering. */
  slot: number;
  state: AtD890BankState;
}

export interface AtD890BankInventory {
  /** The inverted `TalkgroupSet` bitmap. */
  bitmap: AtD890BankBitmapStatus;
  /** Shared bank slot count. */
  capacity: number;
  /** Occupied slots inside the capacity; meaningful only when the bitmap is captured. */
  occupied: number;
  /** Occupied slots that decoded to a classified record. */
  decoded: number;
  /** Occupied slots in radio order. Empty when the bitmap was not captured. */
  entries: readonly AtD890BankEntry[];
  /** Zero-based bit numbers marked occupied at or above the capacity; never decoded. */
  outOfRangeBits: readonly number[];
}

export type AtD890BankReferenceStatus =
  'resolved' | 'out-of-range' | 'absent' | 'not-captured' | 'inventory-not-captured' | 'unreadable';

export interface AtD890BankReference {
  /** One-based bank slot, or `undefined` for a value outside the bank. */
  slot: number | undefined;
  status: AtD890BankReferenceStatus;
  record?: AtD890BankRecord;
}

export interface AtD890RxMember {
  /** One-based stored position; empty positions are skipped but keep their numbering. */
  position: number;
  /** The zero-based bank index as stored. */
  rawIndex: number;
  reference: AtD890BankReference;
  /** Time-slot override, only when the tail bytes were captured. */
  timeSlot?: 1 | 2;
}

export interface AtD890RxGroupEntry {
  /** One-based RX-group slot. */
  slot: number;
  name: { status: 'captured'; text: string } | { status: 'not-captured' };
  members: { status: 'captured'; list: readonly AtD890RxMember[] } | { status: 'not-captured' };
  /** `captured` only when the time-slot override bytes of this record were captured. */
  overrides: 'captured' | 'not-captured';
}

export interface AtD890RxGroupInventory {
  bitmap: AtD890BankBitmapStatus;
  capacity: number;
  occupied: number;
  entries: readonly AtD890RxGroupEntry[];
  outOfRangeBits: readonly number[];
}

/** Captured channel/RX evidence for one bank slot. */
export interface AtD890BankUsage {
  channels: readonly { slot: number; label: string }[];
  rxGroups: readonly { slot: number; name: string; position: number }[];
}

export interface AtD890BankReferences {
  /** True only when every occupied channel decoded, so no channel reference can be missing. */
  channelsComplete: boolean;
  /** True only when every occupied RX group has a captured member list. */
  rxGroupsComplete: boolean;
  /** Evidence by one-based bank slot. Slots absent from the map have no captured reference. */
  bySlot: ReadonlyMap<number, AtD890BankUsage>;
}

/** Text ends at its first NUL or erased `0xFFFF` code unit. */
function decodeField(field: Uint8Array): string {
  let end = field.length - (field.length % 2);
  for (let i = 0; i + 1 < field.length; i += 2) {
    const unit = field[i]! | (field[i + 1]! << 8);
    if (unit === 0 || unit === 0xffff) {
      end = i;
      break;
    }
  }
  return decodeWideCharName(field.subarray(0, end));
}

function isDecimalBcd(bytes: Uint8Array): boolean {
  return bytes.every((b) => b >> 4 <= 9 && (b & 0x0f) <= 9);
}

function decodeBankRecord(raw: Uint8Array, index: number): AtD890BankState {
  const rawCallType = raw[0]!;
  const name = decodeField(raw.subarray(NAME_OFFSET, NAME_OFFSET + NAME_BYTES));
  const idBytes = raw.subarray(2, 6);
  if (!isDecimalBcd(idBytes))
    return {
      kind: 'malformed',
      rawCallType,
      reason: 'The DMR ID bytes are not decimal BCD.',
      name,
    };
  if (rawCallType > 2) return { kind: 'unknown-type', rawCallType, name };
  const field = (offset: number, length: number) =>
    decodeField(raw.subarray(offset, offset + length));
  return {
    kind: 'decoded',
    record: {
      slot: index + 1,
      callType: rawCallType as AtD890CallType,
      dmrId: decodeBcdAsHexU32(idBytes),
      name,
      callsign: field(CALLSIGN_OFFSET, CALLSIGN_BYTES),
      city: field(CITY_OFFSET, CITY_BYTES),
      state: field(STATE_OFFSET, STATE_BYTES),
      country: field(COUNTRY_OFFSET, COUNTRY_BYTES),
      remark: field(REMARK_OFFSET, REMARK_BYTES),
    },
  };
}

/**
 * Decode the shared contact / talk-group bank. `TalkgroupSet` is inverted (a clear bit means
 * occupied) and is trusted only when all of it was captured. Enumeration stops at the hardware
 * capacity; occupied bits beyond it are reported, not decoded.
 */
export function projectAtD890Bank(capture: AtD890ByteReader): AtD890BankInventory {
  const capacity = AT_D890UV_LIMITS.TALK_GROUPS_MAX;
  const raw = capture.read(D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES);
  if (!raw)
    return {
      bitmap: 'not-captured',
      capacity,
      occupied: 0,
      decoded: 0,
      entries: [],
      outOfRangeBits: [],
    };
  const set = listSetBits(raw, true);
  const inRange = set.filter((bit) => bit < capacity);
  const entries = inRange.map((index): AtD890BankEntry => {
    const record = capture.read(talkgroupAddress(index), AT_D890_LIMITS.TALKGROUP_RECORD_SIZE);
    return {
      slot: index + 1,
      state: record ? decodeBankRecord(record, index) : { kind: 'not-captured' },
    };
  });
  return {
    bitmap: 'captured',
    capacity,
    occupied: inRange.length,
    decoded: entries.filter((e) => e.state.kind === 'decoded').length,
    entries,
    outOfRangeBits: set.filter((bit) => bit >= capacity),
  };
}

/**
 * Resolve an already one-based bank slot (a channel `txContactId`) or an RX member (`index + 1`)
 * against the decoded bank. Never matches by DMR ID or by displayed row position.
 */
export function resolveAtD890BankSlot(
  bank: AtD890BankInventory,
  slot: number,
  bySlot: ReadonlyMap<number, AtD890BankEntry> = indexBank(bank),
): AtD890BankReference {
  if (!Number.isInteger(slot) || slot < 1 || slot > bank.capacity)
    return { slot: undefined, status: 'out-of-range' };
  if (bank.bitmap !== 'captured') return { slot, status: 'inventory-not-captured' };
  const entry = bySlot.get(slot);
  if (!entry) return { slot, status: 'absent' };
  if (entry.state.kind === 'decoded')
    return { slot, status: 'resolved', record: entry.state.record };
  if (entry.state.kind === 'not-captured') return { slot, status: 'not-captured' };
  return { slot, status: 'unreadable' };
}

export function indexBank(bank: AtD890BankInventory): ReadonlyMap<number, AtD890BankEntry> {
  return new Map(bank.entries.map((e) => [e.slot, e]));
}

function readMembers(
  capture: AtD890ByteReader,
  index: number,
  bank: AtD890BankInventory,
  bySlot: ReadonlyMap<number, AtD890BankEntry>,
): { members: AtD890RxGroupEntry['members']; overrides: 'captured' | 'not-captured' } {
  const address = receiveGroupAddress(index);
  const memberBytes = capture.read(address, RX_MEMBER_BYTES);
  const tailBytes = capture.read(address + RX_TAIL_OFFSET, AT_D890UV_LIMITS.RX_GROUP_MEMBERS_MAX);
  let slots: (1 | 2 | undefined)[] = [];
  if (tailBytes) {
    const stride = new Uint8Array(RX_TAIL_OFFSET + tailBytes.length);
    stride.set(tailBytes, RX_TAIL_OFFSET);
    slots = decodeAtD890RxGroupTimeSlotOverrides(stride, tailBytes.length);
  }
  const overrides = tailBytes ? 'captured' : 'not-captured';
  if (!memberBytes) return { members: { status: 'not-captured' }, overrides };
  const view = new DataView(memberBytes.buffer, memberBytes.byteOffset, memberBytes.byteLength);
  const list: AtD890RxMember[] = [];
  const count = Math.min(AT_D890UV_LIMITS.RX_GROUP_MEMBERS_MAX, memberBytes.length / 4);
  for (let i = 0; i < count; i++) {
    const rawIndex = view.getUint32(i * 4, true);
    if (rawIndex === RX_EMPTY_MEMBER) continue;
    const override = tailBytes ? slots[i] : undefined;
    list.push({
      position: i + 1,
      rawIndex,
      // The stored value is a zero-based bank index; a value that cannot add one safely is out of range.
      reference:
        rawIndex >= bank.capacity
          ? { slot: undefined, status: 'out-of-range' }
          : resolveAtD890BankSlot(bank, rawIndex + 1, bySlot),
      ...(override ? { timeSlot: override } : {}),
    });
  }
  return { members: { status: 'captured', list }, overrides };
}

/** Decode RX groups: occupancy, name and member spans are each trusted only when captured. */
export function projectAtD890RxGroups(
  capture: AtD890ByteReader,
  bank: AtD890BankInventory,
): AtD890RxGroupInventory {
  const capacity = AT_D890UV_LIMITS.RX_GROUP_LISTS_MAX;
  const raw = capture.read(D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES);
  if (!raw)
    return { bitmap: 'not-captured', capacity, occupied: 0, entries: [], outOfRangeBits: [] };
  const set = listSetBits(raw);
  const inRange = set.filter((bit) => bit < capacity);
  const bySlot = indexBank(bank);
  const entries = inRange.map((index): AtD890RxGroupEntry => {
    const nameBytes = capture.read(receiveGroupAddress(index) + RX_NAME_OFFSET, RX_NAME_BYTES);
    const { members, overrides } = readMembers(capture, index, bank, bySlot);
    return {
      slot: index + 1,
      name: nameBytes
        ? { status: 'captured', text: decodeField(nameBytes) }
        : { status: 'not-captured' },
      members,
      overrides,
    };
  });
  return {
    bitmap: 'captured',
    capacity,
    occupied: inRange.length,
    entries,
    outOfRangeBits: set.filter((bit) => bit >= capacity),
  };
}

/** Channels as this module needs them: a slot, a display label and a one-based contact slot. */
export interface AtD890ChannelContactRef {
  slot: number;
  label: string;
  txContactId?: number;
}

/**
 * Collect the captured evidence that references each bank slot. Coverage flags say whether the
 * evidence could be complete; callers must not present an empty list as proof when they are false.
 */
export function collectAtD890BankReferences(
  channels: {
    bitmap: AtD890BankBitmapStatus;
    occupied: number;
    decoded: number;
    refs: readonly AtD890ChannelContactRef[];
  },
  rxGroups: AtD890RxGroupInventory,
): AtD890BankReferences {
  const usage = new Map<
    number,
    {
      channels: AtD890BankUsage['channels'][number][];
      rxGroups: AtD890BankUsage['rxGroups'][number][];
    }
  >();
  const slotUsage = (slot: number) => {
    let u = usage.get(slot);
    if (!u) usage.set(slot, (u = { channels: [], rxGroups: [] }));
    return u;
  };
  for (const ch of channels.refs)
    if (ch.txContactId != null)
      slotUsage(ch.txContactId).channels.push({ slot: ch.slot, label: ch.label });
  for (const group of rxGroups.entries) {
    if (group.members.status !== 'captured') continue;
    const name = group.name.status === 'captured' ? group.name.text : '';
    for (const m of group.members.list)
      if (m.reference.slot != null)
        slotUsage(m.reference.slot).rxGroups.push({
          slot: group.slot,
          name,
          position: m.position,
        });
  }
  return {
    channelsComplete: channels.bitmap === 'captured' && channels.decoded === channels.occupied,
    rxGroupsComplete:
      rxGroups.bitmap === 'captured' &&
      rxGroups.entries.every((g) => g.members.status === 'captured'),
    bySlot: usage,
  };
}

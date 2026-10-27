/**
 * AT-D890UV talkgroup encode — inverted TalkgroupSet + per-slot stride records.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioTalkGroupDto } from '../../radioWriteProjection.ts';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { clearBitmap, setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import {
  mergeMapRegionsIntoCache,
  mergeImageRegionIntoCache,
  clearTalkgroupDataBlocksFromCache,
  clearTalkgroupOrderBlocksFromCache,
  clearTalkgroupPositionBlocksFromCache,
  talkgroupAddress,
  type AtD890DownloadCache,
} from './memory.ts';
import { encodeBcdAsHexU32 } from './bcd.ts';
import { encodeWideCharName } from './wideChar.ts';
import {
  CALLSIGN_MAX_CHARS,
  CITY_MAX_CHARS,
  COUNTRY_MAX_CHARS,
  REMARK_MAX_CHARS,
  STATE_MAX_CHARS,
} from './contactFieldCaps.ts';

/** Anytone D890 wire call type: Private=0, Group=1, All=2. */
const ANYTONE_CALL_TYPE_GROUP = 0x01;

function writeU32Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
  buf[offset + 2] = (value >> 16) & 0xff;
  buf[offset + 3] = (value >> 24) & 0xff;
}

/**
 * `n` is how many records this call writes. When those slots are not exactly
 * `{0 .. n-1}`, `n` becomes one past the highest written slot so every written
 * slot sits in the prefix. Empty input is `0`. The table itself is always
 * `TALK_GROUPS_MAX` entries.
 */
function talkgroupPositionPrefixLength(slots: readonly number[]): number {
  const limit = AT_D890UV_LIMITS.TALK_GROUPS_MAX;
  if (slots.length === 0) return 0;
  let n = slots.length;
  const present = new Set(slots);
  let contiguous = present.size === n;
  if (contiguous) {
    for (let i = 0; i < n; i++) {
      if (!present.has(i)) {
        contiguous = false;
        break;
      }
    }
  }
  if (!contiguous) {
    let highest = slots[0]!;
    for (const slot of slots) {
      if (slot > highest) highest = slot;
    }
    n = highest + 1;
  }
  return n > limit ? limit : n;
}

/** Identity prefix, then `0xFFFFFFFF` through the end of the search window. */
function encodeAtD890TalkgroupPositionTable(slots: readonly number[]): Uint8Array {
  const table = new Uint8Array(AT_D890UV_LIMITS.TALK_GROUPS_MAX * 4);
  table.fill(0xff);
  const n = talkgroupPositionPrefixLength(slots);
  for (let i = 0; i < n; i++) {
    writeU32Le(table, i * 4, i);
  }
  return table;
}

function encodeAtD890TalkgroupCallType(callType: number | undefined): number {
  switch (callType) {
    case NEONPLUG_CALL_TYPE_PRIVATE:
      return 0;
    case NEONPLUG_CALL_TYPE_GROUP:
      return 1;
    case NEONPLUG_CALL_TYPE_ALL:
      return 2;
    case 0:
    case 1:
    case 2:
      return callType;
    default:
      return ANYTONE_CALL_TYPE_GROUP;
  }
}

/** NeonPlug quick-contact call types (DM-32 projection). */
const NEONPLUG_CALL_TYPE_PRIVATE = 0x03;
const NEONPLUG_CALL_TYPE_GROUP = 0x04;
const NEONPLUG_CALL_TYPE_ALL = 0x05;

/**
 * CPS key: four BCD bytes as a big-endian integer, times 2, plus 1 only for a group call.
 * Private (`0`) and all-call (`2`) share a key for the same ID.
 */
function talkgroupOrderKey(digitalId: number, callType: number | undefined): number {
  const wireCallType = encodeAtD890TalkgroupCallType(callType);
  const bcd = encodeBcdAsHexU32(digitalId);
  const bcdHex = ((bcd[0]! << 24) | (bcd[1]! << 16) | (bcd[2]! << 8) | bcd[3]!) >>> 0;
  return (bcdHex * 2 + (wireCallType & 1)) >>> 0;
}

/** Odd entry counts get one `0xFF`×8 pad. Even counts, including empty, get none. */
function padOddOrderEntry(raw: Uint8Array): Uint8Array {
  if (raw.length % 16 === 0) return raw;
  const out = new Uint8Array(raw.length + 8);
  out.fill(0xff);
  out.set(raw);
  return out;
}

/**
 * Rebuild TalkgroupOrder at `0x3f00000`.
 * Sorted little-endian pairs. Key is the BCD-byte integer times 2, plus 1 for group.
 * Value is the 0-based talkgroup index. A later duplicate key is dropped.
 */
export function encodeAtD890TalkgroupOrder(talkGroups: readonly RadioTalkGroupDto[]): Uint8Array {
  const entries: { key: number; slotId: number }[] = [];
  for (const tg of talkGroups) {
    if (tg.digitalId <= 0 || tg.index < 1) continue;
    entries.push({
      key: talkgroupOrderKey(tg.digitalId, tg.callType),
      slotId: tg.index - 1,
    });
  }
  entries.sort((a, b) => {
    if (a.key < b.key) return -1;
    if (a.key > b.key) return 1;
    return 0;
  });

  const unique: { key: number; slotId: number }[] = [];
  for (const entry of entries) {
    const prev = unique.at(-1);
    if (prev !== undefined && prev.key === entry.key) continue;
    unique.push(entry);
  }

  const raw = new Uint8Array(unique.length * 8);
  for (let i = 0; i < unique.length; i++) {
    const entry = unique[i]!;
    writeU32Le(raw, i * 8, entry.key);
    writeU32Le(raw, i * 8 + 4, entry.slotId);
  }
  return padOddOrderEntry(raw);
}

// CPS record offsets (firmware talkgroup.md §Record, [I]).
const TG_CITY_OFFSET = 0x2a;
const TG_CITY_BYTES = 0x20;
const TG_CALLSIGN_OFFSET = 0x4a;
const TG_CALLSIGN_BYTES = 0x18;
const TG_STATE_OFFSET = 0x62;
const TG_STATE_BYTES = 0x22;
const TG_COUNTRY_OFFSET = 0x84;
const TG_COUNTRY_BYTES = 0x22;
const TG_REMARK_OFFSET = 0xa6;
const TG_REMARK_BYTES = 0x22;

function writeTalkgroupTextField(
  data: Uint8Array,
  value: string | undefined,
  maxChars: number,
  offset: number,
  bytes: number,
): void {
  if (!value) return;
  data.set(encodeWideCharName(value.slice(0, maxChars), bytes), offset);
}

export function encodeAtD890TalkgroupRecord(tg: RadioTalkGroupDto): Uint8Array {
  const data = new Uint8Array(AT_D890_LIMITS.TALKGROUP_RECORD_SIZE);
  data.fill(0);
  data[0] = encodeAtD890TalkgroupCallType(tg.callType);
  if (tg.wireName) {
    data.set(encodeWideCharName(tg.wireName, 0x20), 0x6);
  }
  data.set(encodeBcdAsHexU32(tg.digitalId), 0x2);
  writeTalkgroupTextField(data, tg.city, CITY_MAX_CHARS, TG_CITY_OFFSET, TG_CITY_BYTES);
  writeTalkgroupTextField(
    data,
    tg.callsign,
    CALLSIGN_MAX_CHARS,
    TG_CALLSIGN_OFFSET,
    TG_CALLSIGN_BYTES,
  );
  writeTalkgroupTextField(data, tg.province, STATE_MAX_CHARS, TG_STATE_OFFSET, TG_STATE_BYTES);
  writeTalkgroupTextField(data, tg.country, COUNTRY_MAX_CHARS, TG_COUNTRY_OFFSET, TG_COUNTRY_BYTES);
  writeTalkgroupTextField(data, tg.remark, REMARK_MAX_CHARS, TG_REMARK_OFFSET, TG_REMARK_BYTES);
  return data;
}

export function encodeTalkgroupsIntoAtD890Image(
  image: MemoryMap,
  talkGroups: readonly RadioTalkGroupDto[],
): MemoryMap {
  const set = image.get(D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES).slice();
  clearBitmap(set, true);
  // Slot 10000 is TalkgroupOrder. Filling the bitmap width zeroes that window.
  const max = AT_D890UV_LIMITS.TALK_GROUPS_MAX;
  for (let i = 0; i < max; i++) {
    image.fill(talkgroupAddress(i), AT_D890_LIMITS.TALKGROUP_RECORD_SIZE, 0);
  }
  const writtenSlots: number[] = [];
  for (const tg of talkGroups) {
    if (tg.digitalId <= 0) continue;
    const idx = tg.index - 1;
    if (idx < 0) continue;
    setBitmapBit(set, idx, true, true);
    image.set(talkgroupAddress(idx), encodeAtD890TalkgroupRecord(tg));
    writtenSlots.push(idx);
  }
  image.set(D890_MAP.TalkgroupSet, set);
  image.set(D890_MAP.TalkgroupOrder, encodeAtD890TalkgroupOrder(talkGroups));
  image.set(D890_MAP.TalkgroupPosition, encodeAtD890TalkgroupPositionTable(writtenSlots));
  return image;
}

export function syncTalkgroupRegionsToCache(
  cache: AtD890DownloadCache,
  image: MemoryMap,
  talkGroups?: readonly RadioTalkGroupDto[],
): void {
  mergeMapRegionsIntoCache(cache, image, [
    { address: D890_MAP.TalkgroupSet, length: AT_D890_LIMITS.TALKGROUP_SET_BYTES },
  ]);
  clearTalkgroupDataBlocksFromCache(cache);
  const set = image.get(D890_MAP.TalkgroupSet, AT_D890_LIMITS.TALKGROUP_SET_BYTES);
  for (let idx = 0; idx < set.length * 8; idx++) {
    const byte = Math.floor(idx / 8);
    const bit = idx % 8;
    if ((set[byte]! & (1 << bit)) !== 0) continue;
    mergeImageRegionIntoCache(
      cache,
      image,
      talkgroupAddress(idx),
      AT_D890_LIMITS.TALKGROUP_RECORD_SIZE,
    );
  }
  if (talkGroups) {
    clearTalkgroupOrderBlocksFromCache(cache);
    const order = encodeAtD890TalkgroupOrder(talkGroups);
    mergeImageRegionIntoCache(cache, image, D890_MAP.TalkgroupOrder, order.length);
    clearTalkgroupPositionBlocksFromCache(cache);
    mergeImageRegionIntoCache(
      cache,
      image,
      D890_MAP.TalkgroupPosition,
      AT_D890UV_LIMITS.TALK_GROUPS_MAX * 4,
    );
  }
}

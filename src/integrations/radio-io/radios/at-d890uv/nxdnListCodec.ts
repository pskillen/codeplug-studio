/**
 * AT-D890UV NXDN talk-group / contact list (MM9PDY Write NXDN).
 *
 * One list holds talk groups (group entries) and contacts (individual entries). It is four flash
 * units the firmware reads together (firmware RE, NXDN codeplug):
 *
 * - index table `0x18000000`: 1000 x u32 LE, position to record slot; the list length is the
 *   first `FFFFFFFF`;
 * - inverted set `0x18080000`: clear bit = used slot;
 * - records `0x18100000 + slot * 0xC8`;
 * - order table `0x18180000`: `count` x (key u32 LE, slot u32 LE), sorted by key, where
 *   `key = BCDhex(ID) * 2 + (group ? 1 : 0)`; padded to an even count with `FF` x 8. The firmware
 *   binary-searches it for caller-ID names and RX-group matching, so the index is never written
 *   without it.
 *
 * Studio owns all four units: slot `i` is index `i`, and everything not listed here stays erased.
 */

import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import type { RadioNxdnListEntryDto } from '../../radioWriteProjection.ts';
import { clearBitmap, listSetBits, setBitmapBit } from './bitmap.ts';
import { decodeBcdBytesBe, encodeBcdBytesBe } from './bcd.ts';
import { AT_D890_NXDN } from './constants.ts';
import {
  CALLSIGN_MAX_CHARS,
  CITY_MAX_CHARS,
  COUNTRY_MAX_CHARS,
  STATE_MAX_CHARS,
} from './contactFieldCaps.ts';
import { decodeWideCharName, encodeWideCharName } from './wideChar.ts';

export interface AtD890NxdnStagedBytes {
  address: number;
  bytes: Uint8Array;
}

/** NXDN individual IDs, and group IDs other than all-call. */
export const NXDN_ID_MAX = 65_519;
/** All-call group ID. */
export const NXDN_ALL_CALL_ID = 65_535;

/** Record offsets (CPS NXDN contact element; firmware RE, NXDN codeplug). */
const REC_ATTR = 0x00;
const REC_ID = 0x02;
const REC_NAME = 0x06;
const REC_NAME_BYTES = 0x24;
const REC_CITY = 0x4c;
const REC_CITY_BYTES = 0x20;
const REC_CALLSIGN = 0x6c;
const REC_CALLSIGN_BYTES = 0x18;
const REC_STATE = 0x84;
const REC_STATE_BYTES = 0x22;
const REC_COUNTRY = 0xa6;
const REC_COUNTRY_BYTES = 0x22;

function writeU32Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

function readU32Le(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! << 24)) >>>
    0
  );
}

/** True when the radio accepts this ID for this kind of entry (firmware entry check). */
export function isValidAtD890NxdnId(id: number, kind: 'group' | 'individual'): boolean {
  if (!Number.isInteger(id)) return false;
  if (id >= 1 && id <= NXDN_ID_MAX) return true;
  return kind === 'group' && id === NXDN_ALL_CALL_ID;
}

function assertEntry(entry: RadioNxdnListEntryDto, index: number): void {
  if (!isValidAtD890NxdnId(entry.nxdnId, entry.kind)) {
    throw new RangeError(
      `NXDN list entry ${index} has ${entry.kind} ID ${entry.nxdnId}, which the radio does not accept`,
    );
  }
}

function writeText(
  record: Uint8Array,
  value: string | undefined,
  maxChars: number,
  offset: number,
  bytes: number,
): void {
  if (!value) return;
  record.set(encodeWideCharName(value.slice(0, maxChars), bytes), offset);
}

/** One `0xC8` list record. */
export function encodeAtD890NxdnListRecord(entry: RadioNxdnListEntryDto): Uint8Array {
  const record = new Uint8Array(AT_D890_NXDN.ListRecordSize);
  record[REC_ATTR] = entry.kind === 'group' ? 1 : 0;
  record.set(encodeBcdBytesBe(entry.nxdnId, 3), REC_ID);
  record.set(
    encodeWideCharName(entry.wireName.slice(0, AT_D890UV_LIMITS.NXDN_NAME_MAX), REC_NAME_BYTES),
    REC_NAME,
  );
  writeText(record, entry.city, CITY_MAX_CHARS, REC_CITY, REC_CITY_BYTES);
  writeText(record, entry.callsign, CALLSIGN_MAX_CHARS, REC_CALLSIGN, REC_CALLSIGN_BYTES);
  writeText(record, entry.state, STATE_MAX_CHARS, REC_STATE, REC_STATE_BYTES);
  writeText(record, entry.country, COUNTRY_MAX_CHARS, REC_COUNTRY, REC_COUNTRY_BYTES);
  return record;
}

/** Order key: the 6-digit BCD as a hex integer, times 2, plus 1 for a group entry. */
export function atD890NxdnOrderKey(nxdnId: number, kind: 'group' | 'individual'): number {
  const bcd = encodeBcdBytesBe(nxdnId, 3);
  const bcdHex = (bcd[0]! << 16) | (bcd[1]! << 8) | bcd[2]!;
  return bcdHex * 2 + (kind === 'group' ? 1 : 0);
}

/** Order table bytes: ascending by key (a later duplicate key is dropped), padded to an even count. */
export function encodeAtD890NxdnListOrder(entries: readonly RadioNxdnListEntryDto[]): Uint8Array {
  const rows = entries
    .map((entry, slot) => ({ key: atD890NxdnOrderKey(entry.nxdnId, entry.kind), slot }))
    .sort((a, b) => a.key - b.key || a.slot - b.slot);
  const unique = rows.filter((row, i) => i === 0 || row.key !== rows[i - 1]!.key);
  const padded = unique.length % 2 === 0 ? unique.length : unique.length + 1;
  const out = new Uint8Array(padded * AT_D890_NXDN.ListOrderEntryBytes);
  out.fill(0xff);
  unique.forEach((row, i) => {
    writeU32Le(out, i * AT_D890_NXDN.ListOrderEntryBytes, row.key);
    writeU32Le(out, i * AT_D890_NXDN.ListOrderEntryBytes + 4, row.slot);
  });
  return out;
}

/**
 * The bytes Studio stages for the whole NXDN list: index table, inverted set, records, order table.
 * Slot `i` holds `entries[i]`. Throws when an ID is out of range or the list is over capacity.
 */
export function encodeAtD890NxdnList(
  entries: readonly RadioNxdnListEntryDto[],
): AtD890NxdnStagedBytes[] {
  if (entries.length > AT_D890UV_LIMITS.NXDN_LIST_MAX) {
    throw new RangeError(
      `NXDN list has ${entries.length} entries; the radio holds ${AT_D890UV_LIMITS.NXDN_LIST_MAX}`,
    );
  }
  entries.forEach(assertEntry);
  const n = entries.length;

  const index = new Uint8Array(AT_D890_NXDN.ListIndexBytes).fill(0xff);
  for (let i = 0; i < n; i++) writeU32Le(index, i * 4, i);

  const set = new Uint8Array(AT_D890_NXDN.ListSetBytes);
  clearBitmap(set, true);
  for (let i = 0; i < n; i++) setBitmapBit(set, i, true, true);

  const records = new Uint8Array(n * AT_D890_NXDN.ListRecordSize);
  entries.forEach((entry, i) => {
    records.set(encodeAtD890NxdnListRecord(entry), i * AT_D890_NXDN.ListRecordSize);
  });

  const out: AtD890NxdnStagedBytes[] = [
    { address: AT_D890_NXDN.ListIndex, bytes: index },
    { address: AT_D890_NXDN.ListSet, bytes: set },
  ];
  if (n > 0) out.push({ address: AT_D890_NXDN.ListData, bytes: records });
  const order = encodeAtD890NxdnListOrder(entries);
  if (order.length > 0) out.push({ address: AT_D890_NXDN.ListOrder, bytes: order });
  return out;
}

/** Decode one list record (inverse of {@link encodeAtD890NxdnListRecord}). */
export function decodeAtD890NxdnListRecord(record: Uint8Array): RadioNxdnListEntryDto {
  const text = (offset: number, bytes: number) =>
    decodeWideCharName(record.subarray(offset, offset + bytes));
  const city = text(REC_CITY, REC_CITY_BYTES);
  const callsign = text(REC_CALLSIGN, REC_CALLSIGN_BYTES);
  const state = text(REC_STATE, REC_STATE_BYTES);
  const country = text(REC_COUNTRY, REC_COUNTRY_BYTES);
  return {
    wireName: text(REC_NAME, REC_NAME_BYTES),
    nxdnId: decodeBcdBytesBe(record.subarray(REC_ID, REC_ID + 3)),
    kind: record[REC_ATTR] === 0 ? 'individual' : 'group',
    ...(callsign ? { callsign } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(country ? { country } : {}),
  };
}

/**
 * Decode the list from a byte reader (a cache or a test image): the length is the first
 * `FFFFFFFF` in the index table, and each row is `record[index[position]]`.
 */
export function decodeAtD890NxdnList(
  read: (address: number, length: number) => Uint8Array,
): RadioNxdnListEntryDto[] {
  const index = read(AT_D890_NXDN.ListIndex, AT_D890_NXDN.ListIndexBytes);
  const set = read(AT_D890_NXDN.ListSet, AT_D890_NXDN.ListSetBytes);
  const used = new Set(listSetBits(set, true));
  const out: RadioNxdnListEntryDto[] = [];
  for (let pos = 0; pos < AT_D890_NXDN.ListIndexEntries; pos++) {
    const slot = readU32Le(index, pos * 4);
    if (slot === 0xffff_ffff) break;
    if (slot >= AT_D890UV_LIMITS.NXDN_LIST_MAX || !used.has(slot)) continue;
    out.push(
      decodeAtD890NxdnListRecord(
        read(
          AT_D890_NXDN.ListData + slot * AT_D890_NXDN.ListRecordSize,
          AT_D890_NXDN.ListRecordSize,
        ),
      ),
    );
  }
  return out;
}

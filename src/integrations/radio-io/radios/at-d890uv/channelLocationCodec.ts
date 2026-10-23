/**
 * MM9PDY AT-D890UV channel location table (storage contract v1).
 *
 * The firmware repo owns this layout: see the "Storage contract v1" comment on
 * pskillen/anytone-d890-firmware#75 and `docs/reference/radios/anytone/at-d890uv/channel-locations.md`.
 *
 * Header, 32 bytes at `+0x00`: magic `LOC1`, version `1`, entry size `16`, entry count
 * (u16 LE), unit (`0` km, `1` miles), reserved `00`, CRC-32 (IEEE) of bytes 0-27 (LE).
 *
 * Entry *n* (memory channel index *n*, 0-based) at `+0x20 + 16n`: latitude and longitude
 * (i32 LE micro-degrees, north and east positive), the channel record's RX frequency bytes
 * `+0x00..03` verbatim, CRC-16/CCITT-FALSE of the record's UTF-16LE name at `+0x44`
 * (up to the first `0000` / `FFFF` unit, at most 16 units, LE), flags (bit 0 = position
 * present), check = (8-bit sum of bytes 0-14) XOR `0xA5`. Empty slots are all `00`.
 *
 * The fingerprint fields are read from the **encoded** channel record in the write image, so
 * they always match the bytes the firmware compares against.
 */

import type { ChannelDistanceUnit } from '@core/models/radioBuild.ts';
import { geoPointIsUsable } from '@core/domain/channelLocation.ts';
import type { MemoryMap } from '../../types.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import { crc16CcittFalse, crc32Ieee } from '../../kit/checksums.ts';
import {
  AT_D890_CHANNEL_LOCATION,
  AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES,
  AT_D890_LIMITS,
  D890_MAP,
} from './constants.ts';
import { listSetBits } from './bitmap.ts';
import { readCombinedChannelRecord } from './channelCodec.ts';

const NAME_OFFSET = 0x44;
const NAME_MAX_UNITS = 16;
const FLAG_POSITION_PRESENT = 0x01;
const CHECK_XOR = 0xa5;

export interface AtD890ChannelLocationEntry {
  /** Micro-degrees, north positive. */
  latMicro: number;
  /** Micro-degrees, east positive. */
  lonMicro: number;
  rxFrequencyBytes: Uint8Array;
  nameCrc: number;
}

export interface AtD890ChannelLocationTable {
  unit: ChannelDistanceUnit;
  count: number;
  /** One per slot `0..count-1`; `null` for an empty or corrupt slot. */
  entries: (AtD890ChannelLocationEntry | null)[];
}

export interface AtD890ChannelLocationEncodeResult {
  /** Header plus every slot `0..count-1`, ready to stage at {@link AT_D890_CHANNEL_LOCATION.BASE_ADDRESS}. */
  bytes: Uint8Array;
  count: number;
  /** Slots that hold a position. */
  positions: number;
}

export function microDegrees(degrees: number): number {
  return Math.round(degrees * 1_000_000);
}

/** CRC-16/CCITT-FALSE of the UTF-16LE name units up to the first `0000`/`FFFF`, max 16 units. */
export function atD890ChannelNameCrc(record: Uint8Array): number {
  let units = 0;
  for (; units < NAME_MAX_UNITS; units++) {
    const off = NAME_OFFSET + units * 2;
    const unit = record[off]! | (record[off + 1]! << 8);
    if (unit === 0x0000 || unit === 0xffff) break;
  }
  return crc16CcittFalse(record.subarray(NAME_OFFSET, NAME_OFFSET + units * 2));
}

function entryCheck(entry: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < 15; i++) sum = (sum + entry[i]!) & 0xff;
  return sum ^ CHECK_XOR;
}

/** Encode one 16-byte entry from an encoded `0x80` channel record and a position. */
export function encodeAtD890ChannelLocationEntry(
  record: Uint8Array,
  location: { lat: number; lon: number },
): Uint8Array {
  const entry = new Uint8Array(AT_D890_CHANNEL_LOCATION.ENTRY_BYTES);
  const view = new DataView(entry.buffer);
  view.setInt32(0, microDegrees(location.lat), true);
  view.setInt32(4, microDegrees(location.lon), true);
  entry.set(record.subarray(0, 4), 8);
  view.setUint16(12, atD890ChannelNameCrc(record), true);
  entry[14] = FLAG_POSITION_PRESENT;
  entry[15] = entryCheck(entry);
  return entry;
}

function encodeHeader(count: number, unit: ChannelDistanceUnit): Uint8Array {
  const header = new Uint8Array(AT_D890_CHANNEL_LOCATION.HEADER_BYTES);
  const view = new DataView(header.buffer);
  for (let i = 0; i < 4; i++) header[i] = AT_D890_CHANNEL_LOCATION.MAGIC.charCodeAt(i);
  header[4] = AT_D890_CHANNEL_LOCATION.VERSION;
  header[5] = AT_D890_CHANNEL_LOCATION.ENTRY_BYTES;
  view.setUint16(6, count, true);
  header[8] = unit === 'mi' ? 1 : 0;
  view.setUint32(28, crc32Ieee(header.subarray(0, 28)), true);
  return header;
}

function channelIsWritten(ch: RadioChannelDto): boolean {
  return !ch.empty && ch.rxHz > 0;
}

/** True when the DTO asks for a table entry (Use location on and a usable position). */
export function radioChannelHasTablePosition(ch: RadioChannelDto): boolean {
  return channelIsWritten(ch) && ch.useLocation === true && geoPointIsUsable(ch.location);
}

/**
 * Build the table from the write image **after** the channel encode.
 *
 * `count` is the highest occupied memory channel in the image (so every slot the radio can
 * reach on this codeplug has an entry). Every slot `0..count-1` is written; empty slots are
 * all `00`. A position is written only when the slot is occupied in `ChannelSet`.
 */
export function encodeAtD890ChannelLocationTable(
  image: MemoryMap,
  channels: readonly RadioChannelDto[],
  unit: ChannelDistanceUnit = 'km',
): AtD890ChannelLocationEncodeResult {
  const occupied = new Set(
    listSetBits(image.get(D890_MAP.ChannelSet, AT_D890_LIMITS.CHANNEL_SET_BYTES)).filter(
      (idx) => idx < AT_D890_CHANNEL_LOCATION.MAX_ENTRIES,
    ),
  );
  const count = occupied.size === 0 ? 0 : Math.max(...occupied) + 1;
  const bytes = new Uint8Array(
    AT_D890_CHANNEL_LOCATION.HEADER_BYTES + count * AT_D890_CHANNEL_LOCATION.ENTRY_BYTES,
  );
  bytes.set(encodeHeader(count, unit), 0);

  let positions = 0;
  for (const ch of channels) {
    if (!radioChannelHasTablePosition(ch)) continue;
    const idx = ch.slotIndex - 1;
    if (idx < 0 || idx >= count || !occupied.has(idx)) continue;
    const record = readCombinedChannelRecord(image, idx);
    bytes.set(
      encodeAtD890ChannelLocationEntry(record, ch.location!),
      AT_D890_CHANNEL_LOCATION.HEADER_BYTES + idx * AT_D890_CHANNEL_LOCATION.ENTRY_BYTES,
    );
    positions += 1;
  }
  return { bytes, count, positions };
}

/**
 * Decode the table as the firmware would. Returns `null` for a bad magic, version, entry
 * size, count or header CRC (for example the factory test pattern). A slot whose flags or
 * check byte do not match decodes as `null`.
 */
export function decodeAtD890ChannelLocationTable(
  data: Uint8Array,
): AtD890ChannelLocationTable | null {
  if (data.length < AT_D890_CHANNEL_LOCATION.HEADER_BYTES) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = String.fromCharCode(data[0]!, data[1]!, data[2]!, data[3]!);
  if (magic !== AT_D890_CHANNEL_LOCATION.MAGIC) return null;
  if (data[4] !== AT_D890_CHANNEL_LOCATION.VERSION) return null;
  if (data[5] !== AT_D890_CHANNEL_LOCATION.ENTRY_BYTES) return null;
  if (view.getUint32(28, true) !== crc32Ieee(data.subarray(0, 28))) return null;
  const count = view.getUint16(6, true);
  if (count > AT_D890_CHANNEL_LOCATION.MAX_ENTRIES) return null;
  if (
    AT_D890_CHANNEL_LOCATION.HEADER_BYTES + count * 16 >
    AT_D890_CHANNEL_LOCATION_TABLE_MAX_BYTES
  ) {
    return null;
  }
  const unitByte = data[8];
  if (unitByte !== 0 && unitByte !== 1) return null;

  const entries: (AtD890ChannelLocationEntry | null)[] = [];
  for (let n = 0; n < count; n++) {
    const off = AT_D890_CHANNEL_LOCATION.HEADER_BYTES + n * AT_D890_CHANNEL_LOCATION.ENTRY_BYTES;
    if (off + AT_D890_CHANNEL_LOCATION.ENTRY_BYTES > data.length) {
      entries.push(null);
      continue;
    }
    const entry = data.subarray(off, off + AT_D890_CHANNEL_LOCATION.ENTRY_BYTES);
    if ((entry[14]! & FLAG_POSITION_PRESENT) === 0 || entry[15] !== entryCheck(entry)) {
      entries.push(null);
      continue;
    }
    const ev = new DataView(entry.buffer, entry.byteOffset, entry.byteLength);
    entries.push({
      latMicro: ev.getInt32(0, true),
      lonMicro: ev.getInt32(4, true),
      rxFrequencyBytes: entry.slice(8, 12),
      nameCrc: ev.getUint16(12, true),
    });
  }
  return { unit: unitByte === 1 ? 'mi' : 'km', count, entries };
}

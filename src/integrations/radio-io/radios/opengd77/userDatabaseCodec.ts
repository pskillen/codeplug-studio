/**
 * OpenUV380 User Database / call-sign DB encode (qdmr OpenUV380CallsignDB facts only).
 * Cite: docs/reference/radios/opengd77/ — FLASH header 0x50000, overflow 0xd8000.
 * Class comments saying 0x30000 are GD-77 copy-paste; do not use.
 */

import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import {
  OPENGD77_USER_DATABASE_MAX,
  OPENUV380_USER_DB_ENTRIES0_ABS,
  OPENUV380_USER_DB_ENTRIES0_MAX,
  OPENUV380_USER_DB_ENTRIES1_ABS,
  OPENUV380_USER_DB_ENTRY_SIZE,
  OPENUV380_USER_DB_HEADER_ABS,
  OPENUV380_USER_DB_HEADER_SIZE,
  OPENUV380_USER_DB_TEXT_CHARS,
} from './constants.ts';

/** 6-bit LUT from qdmr OpenGD77BaseCallsignDB::DatabaseEntryElement::_lut. */
const PACK_LUT =
  ' 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.';

const FORMAT_COMPRESSED = 78;
const ENTRY_SIZE_WIRE_BIAS = 0x4a;

export interface OpenGd77UserDatabaseEncodeResult {
  headerAbs: number;
  header: Uint8Array;
  entries0Abs: number;
  entries0: Uint8Array;
  entries1Abs: number;
  entries1: Uint8Array;
  entryCount: number;
  truncated: number;
}

export interface OpenGd77UserDatabaseDecodedEntry {
  digitalId: number;
  text: string;
}

export function composeUserDatabaseText(row: RadioDigitalContactDto): string {
  const parts: string[] = [];
  const callsign = row.callsign.trim();
  const name = row.wireName.trim();
  if (callsign) parts.push(callsign);
  if (name && name !== callsign) parts.push(name);
  if (row.city.trim()) parts.push(row.city.trim());
  if (row.province.trim()) parts.push(row.province.trim());
  if (row.country.trim()) parts.push(row.country.trim());
  return parts.join(' ');
}

export function packUserDatabaseText(text: string, textChars = OPENUV380_USER_DB_TEXT_CHARS): Uint8Array {
  const packedLen = (3 * textChars) / 4;
  const codes: number[] = [];
  for (const ch of text) {
    const idx = PACK_LUT.indexOf(ch);
    if (idx < 0) continue;
    codes.push(idx);
    if (codes.length >= textChars) break;
  }
  while (codes.length % 4 !== 0) codes.push(0);
  const out = new Uint8Array(packedLen);
  for (let i = 0, o = 0; i < codes.length && o + 2 < packedLen; i += 4, o += 3) {
    const encoded =
      ((codes[i]! & 0x3f) << 18) |
      ((codes[i + 1]! & 0x3f) << 12) |
      ((codes[i + 2]! & 0x3f) << 6) |
      (codes[i + 3]! & 0x3f);
    out[o] = (encoded >>> 16) & 0xff;
    out[o + 1] = (encoded >>> 8) & 0xff;
    out[o + 2] = encoded & 0xff;
  }
  return out;
}

export function unpackUserDatabaseText(packed: Uint8Array, textChars = OPENUV380_USER_DB_TEXT_CHARS): string {
  const chars: string[] = [];
  for (let o = 0; o + 2 < packed.length && chars.length < textChars; o += 3) {
    const encoded = (packed[o]! << 16) | (packed[o + 1]! << 8) | packed[o + 2]!;
    const codes = [(encoded >>> 18) & 0x3f, (encoded >>> 12) & 0x3f, (encoded >>> 6) & 0x3f, encoded & 0x3f];
    for (const code of codes) {
      if (chars.length >= textChars) break;
      chars.push(PACK_LUT[code] ?? ' ');
    }
  }
  return chars.join('').replace(/\s+$/, '');
}

function writeU32Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
  buf[offset + 3] = (value >>> 24) & 0xff;
}

function readU32Le(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16) | (buf[offset + 3]! << 24)) >>>
    0
  );
}

function writeU24Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
  buf[offset + 2] = (value >>> 16) & 0xff;
}

function readU24Le(buf: Uint8Array, offset: number): number {
  return (buf[offset]! | (buf[offset + 1]! << 8) | (buf[offset + 2]! << 16)) >>> 0;
}

export function encodeUserDatabaseHeader(entryCount: number, entrySize = OPENUV380_USER_DB_ENTRY_SIZE): Uint8Array {
  const header = new Uint8Array(OPENUV380_USER_DB_HEADER_SIZE);
  header[0] = 0x49; // I
  header[1] = 0x64; // d
  header[2] = FORMAT_COMPRESSED;
  header[3] = ENTRY_SIZE_WIRE_BIAS + entrySize;
  header[4] = 0x30;
  header[5] = 0x30;
  header[6] = 0x31;
  writeU32Le(header, 8, entryCount);
  return header;
}

export function decodeUserDatabaseHeader(header: Uint8Array): { entryCount: number; entrySize: number } {
  if (header.length < OPENUV380_USER_DB_HEADER_SIZE) {
    throw new RangeError('User Database header is truncated');
  }
  const magic = String.fromCharCode(header[0]!, header[1]!);
  if (magic !== 'Id') {
    throw new Error(`User Database header magic is ${JSON.stringify(magic)}, expected "Id"`);
  }
  return {
    entrySize: header[3]! - ENTRY_SIZE_WIRE_BIAS,
    entryCount: readU32Le(header, 8),
  };
}

function encodeEntry(row: RadioDigitalContactDto): Uint8Array {
  const rec = new Uint8Array(OPENUV380_USER_DB_ENTRY_SIZE);
  writeU24Le(rec, 0, row.digitalId >>> 0);
  rec.set(packUserDatabaseText(composeUserDatabaseText(row)), 3);
  return rec;
}

function decodeEntry(rec: Uint8Array): OpenGd77UserDatabaseDecodedEntry {
  return {
    digitalId: readU24Le(rec, 0),
    text: unpackUserDatabaseText(rec.subarray(3)),
  };
}

export function encodeOpenGd77UserDatabase(
  rows: readonly RadioDigitalContactDto[],
  warnings: string[] = [],
): OpenGd77UserDatabaseEncodeResult {
  const valid = rows.filter((row) => row.digitalId > 0);
  valid.sort((a, b) => a.digitalId - b.digitalId);
  const cap = OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX;
  const truncated = Math.max(0, valid.length - cap);
  if (truncated > 0) {
    warnings.push(
      `Directory has more contacts than the OpenGD77 User Database allows; only ${cap} write from directory`,
    );
  }
  const kept = valid.slice(0, cap);
  const n0 = Math.min(kept.length, OPENUV380_USER_DB_ENTRIES0_MAX);
  const n1 = kept.length - n0;
  const entries0 = new Uint8Array(n0 * OPENUV380_USER_DB_ENTRY_SIZE);
  const entries1 = new Uint8Array(n1 * OPENUV380_USER_DB_ENTRY_SIZE);
  for (let i = 0; i < n0; i++) {
    entries0.set(encodeEntry(kept[i]!), i * OPENUV380_USER_DB_ENTRY_SIZE);
  }
  for (let i = 0; i < n1; i++) {
    entries1.set(encodeEntry(kept[n0 + i]!), i * OPENUV380_USER_DB_ENTRY_SIZE);
  }
  return {
    headerAbs: OPENUV380_USER_DB_HEADER_ABS,
    header: encodeUserDatabaseHeader(kept.length),
    entries0Abs: OPENUV380_USER_DB_ENTRIES0_ABS,
    entries0,
    entries1Abs: OPENUV380_USER_DB_ENTRIES1_ABS,
    entries1,
    entryCount: kept.length,
    truncated,
  };
}

export function decodeOpenGd77UserDatabase(
  header: Uint8Array,
  entries0: Uint8Array,
  entries1: Uint8Array = new Uint8Array(0),
): OpenGd77UserDatabaseDecodedEntry[] {
  const { entryCount, entrySize } = decodeUserDatabaseHeader(header);
  if (entrySize !== OPENUV380_USER_DB_ENTRY_SIZE) {
    throw new Error(`User Database entry size ${entrySize} is not OpenUV380 0x1b`);
  }
  const out: OpenGd77UserDatabaseDecodedEntry[] = [];
  const n0 = Math.min(entryCount, OPENUV380_USER_DB_ENTRIES0_MAX);
  const n1 = Math.max(0, entryCount - n0);
  for (let i = 0; i < n0; i++) {
    const start = i * OPENUV380_USER_DB_ENTRY_SIZE;
    out.push(decodeEntry(entries0.subarray(start, start + OPENUV380_USER_DB_ENTRY_SIZE)));
  }
  for (let i = 0; i < n1; i++) {
    const start = i * OPENUV380_USER_DB_ENTRY_SIZE;
    out.push(decodeEntry(entries1.subarray(start, start + OPENUV380_USER_DB_ENTRY_SIZE)));
  }
  return out;
}

export function userDatabaseCountFromOccupied(bytes: Uint8Array | undefined): number | undefined {
  if (!bytes || bytes.byteLength < OPENUV380_USER_DB_HEADER_SIZE) return undefined;
  try {
    return decodeUserDatabaseHeader(bytes.subarray(0, OPENUV380_USER_DB_HEADER_SIZE)).entryCount;
  } catch {
    return undefined;
  }
}

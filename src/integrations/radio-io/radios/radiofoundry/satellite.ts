/** Debug-link SATELLITE (RadioFoundry docs/spec/satellite.md §6, docs/spec/debuglink.md §3.30 at 454a5b76). */
import type { RadioFoundrySatelliteProfile } from '@core/radios/radiofoundry/satelliteCapability.ts';
import { RadioProtocolError } from '../../kit/errors.ts';

export const SATELLITE_COMMAND = 0x26;
export const SAT_OP_INFO = 0;
export const SAT_OP_LIST = 1;
export const SAT_OP_DATA = 3;
export const SAT_OP_COMMIT = 4;
export const SAT_OP_ABORT = 5;
export const SAT_OP_REPLACE_BEGIN = 9;
export const SAT_OP_PROFILE_VALUES_GET = 11;
export const SAT_OP_PROFILE_STAGE_CHUNK = 12;
/** The only operations Studio sends. Everything else is refused before a byte goes out. */
export const SAT_ALLOWED_OPS: ReadonlySet<number> = new Set([0, 1, 3, 4, 5, 9, 11, 12]);
/** Satellite protocol versions Studio speaks: 6 added chunked profiles (up to 10), 7 is the version at 454a5b76. */
export const SAT_PROTOCOL_VERSIONS: readonly number[] = [6, 7];
export const SAT_DATA_CHUNK_MAX = 59;
export const SAT_PROFILE_CHUNK_MAX = 4;
export const SAT_TLE_LINE_LENGTH = 69;

export interface RadioFoundrySatelliteRecord {
  catalogId: number;
  name: string;
  line1: string;
  line2: string;
}
export interface RadioFoundrySatelliteInfo {
  protocol: number;
  capacity: number;
  installed: number;
}
export interface RadioFoundrySatelliteListEntry {
  catalogId: number;
  epoch: number;
}

function writeU16(buf: Uint8Array, off: number, v: number): void {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >>> 8) & 0xff;
}

function writeU32(buf: Uint8Array, off: number, v: number): void {
  buf[off] = v & 0xff;
  buf[off + 1] = (v >>> 8) & 0xff;
  buf[off + 2] = (v >>> 16) & 0xff;
  buf[off + 3] = (v >>> 24) & 0xff;
}

function readU16(buf: Uint8Array, off: number): number {
  return buf[off]! | (buf[off + 1]! << 8);
}

function readU32(buf: Uint8Array, off: number): number {
  return (buf[off]! | (buf[off + 1]! << 8) | (buf[off + 2]! << 16) | (buf[off + 3]! << 24)) >>> 0;
}

/** UTF-8 name bytes: control characters dropped, trimmed, cut to `maxBytes` on a character boundary. */
export function encodeSatelliteName(name: string, maxBytes: number): Uint8Array {
  let cleaned = '';
  for (const ch of name) {
    if (ch.charCodeAt(0) < 0x20) continue;
    cleaned += ch;
  }
  cleaned = cleaned.trim();
  const encoded = new TextEncoder().encode(cleaned);
  if (encoded.length <= maxBytes) return encoded;
  let end = maxBytes;
  while (end > 0 && (encoded[end]! & 0xc0) === 0x80) end -= 1;
  return encoded.subarray(0, end);
}

function isPrintableAsciiLine(line: string): boolean {
  if (line.length !== SAT_TLE_LINE_LENGTH) return false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line.charCodeAt(i);
    if (c < 0x20 || c > 0x7e) return false;
  }
  return true;
}

/** The record stream, ascending by catalog number. Throws RadioProtocolError on an empty set, a duplicate catalog
 *  number, an empty encoded name, or a line that is not 69 printable ASCII characters. */
export function serialiseSatelliteRecords(
  records: readonly RadioFoundrySatelliteRecord[],
  maxNameBytes: number,
): Uint8Array {
  if (records.length === 0) {
    throw new RadioProtocolError('RadioFoundry satellite record set is empty.');
  }
  const sorted = [...records].sort((a, b) => a.catalogId - b.catalogId);
  const seen = new Set<number>();
  const parts: Uint8Array[] = [];
  for (const rec of sorted) {
    if (seen.has(rec.catalogId)) {
      throw new RadioProtocolError('RadioFoundry satellite record catalog numbers must be unique.');
    }
    seen.add(rec.catalogId);
    if (!isPrintableAsciiLine(rec.line1) || !isPrintableAsciiLine(rec.line2)) {
      throw new RadioProtocolError('RadioFoundry satellite TLE lines must be 69 printable ASCII characters.');
    }
    const name = encodeSatelliteName(rec.name, maxNameBytes);
    if (name.length === 0) {
      throw new RadioProtocolError('RadioFoundry satellite name encodes to zero bytes.');
    }
    const head = new Uint8Array(5 + name.length + SAT_TLE_LINE_LENGTH * 2);
    writeU32(head, 0, rec.catalogId);
    head[4] = name.length;
    head.set(name, 5);
    const enc = new TextEncoder();
    head.set(enc.encode(rec.line1), 5 + name.length);
    head.set(enc.encode(rec.line2), 5 + name.length + SAT_TLE_LINE_LENGTH);
    parts.push(head);
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/** PROFILE_STAGE_CHUNK argument blocks (without the op byte), ascending by catalog number, 4 per chunk. */
export function encodeProfileChunks(
  transactionId: number,
  profiles: readonly RadioFoundrySatelliteProfile[],
): Uint8Array[] {
  const sorted = [...profiles].sort((a, b) => a.catalogId - b.catalogId);
  const total = sorted.length;
  const chunks: Uint8Array[] = [];
  for (let start = 0; start < total; start += SAT_PROFILE_CHUNK_MAX) {
    const slice = sorted.slice(start, start + SAT_PROFILE_CHUNK_MAX);
    const count = slice.length;
    const buf = new Uint8Array(5 + count * 14);
    writeU16(buf, 0, transactionId);
    buf[2] = total;
    buf[3] = start;
    buf[4] = count;
    let o = 5;
    for (const p of slice) {
      writeU32(buf, o, p.catalogId);
      writeU32(buf, o + 4, p.rxHz);
      writeU32(buf, o + 8, p.txHz);
      writeU16(buf, o + 12, p.toneTenths);
      o += 14;
    }
    chunks.push(buf);
  }
  return chunks;
}

export function encodeReplaceBegin(recordCount: number, byteCount: number, crc: number): Uint8Array {
  const buf = new Uint8Array(8);
  writeU16(buf, 0, recordCount);
  writeU16(buf, 2, byteCount);
  writeU32(buf, 4, crc);
  return buf;
}

export function encodeDataChunk(transactionId: number, offset: number, bytes: Uint8Array): Uint8Array {
  const buf = new Uint8Array(4 + bytes.length);
  writeU16(buf, 0, transactionId);
  writeU16(buf, 2, offset);
  buf.set(bytes, 4);
  return buf;
}

export function encodeCommit(transactionId: number, crc: number): Uint8Array {
  const buf = new Uint8Array(6);
  writeU16(buf, 0, transactionId);
  writeU32(buf, 2, crc);
  return buf;
}

export function encodeTransactionId(transactionId: number): Uint8Array {
  const buf = new Uint8Array(2);
  writeU16(buf, 0, transactionId);
  return buf;
}

export function parseSatelliteInfo(body: Uint8Array): RadioFoundrySatelliteInfo {
  if (body.length !== 5) {
    throw new RadioProtocolError('RadioFoundry satellite INFO body has wrong length.');
  }
  return {
    protocol: body[0]!,
    capacity: readU16(body, 1),
    installed: readU16(body, 3),
  };
}

export function parseSatelliteList(body: Uint8Array): RadioFoundrySatelliteListEntry[] {
  if (body.length < 1 || (body.length - 1) % 8 !== 0) {
    throw new RadioProtocolError('RadioFoundry satellite LIST body has wrong length.');
  }
  const count = body[0]!;
  const expected = 1 + count * 8;
  if (body.length !== expected) {
    throw new RadioProtocolError('RadioFoundry satellite LIST body has wrong length.');
  }
  const out: RadioFoundrySatelliteListEntry[] = [];
  for (let i = 0; i < count; i += 1) {
    const off = 1 + i * 8;
    out.push({
      catalogId: readU32(body, off),
      epoch: readU32(body, off + 4),
    });
  }
  return out;
}

export function parseProfileValues(body: Uint8Array): RadioFoundrySatelliteProfile[] {
  if (body.length < 1 || (body.length - 1) % 14 !== 0) {
    throw new RadioProtocolError('RadioFoundry satellite profile body has wrong length.');
  }
  const count = body[0]!;
  const expected = 1 + count * 14;
  if (body.length !== expected) {
    throw new RadioProtocolError('RadioFoundry satellite profile body has wrong length.');
  }
  const out: RadioFoundrySatelliteProfile[] = [];
  for (let i = 0; i < count; i += 1) {
    const off = 1 + i * 14;
    out.push({
      catalogId: readU32(body, off),
      rxHz: readU32(body, off + 4),
      txHz: readU32(body, off + 8),
      toneTenths: readU16(body, off + 12),
    });
  }
  return out;
}

const MS_PER_DAY = 86_400_000;

function daysSinceEpochToYearStart(year: number): number {
  return Math.trunc(Date.UTC(year, 0, 1) / MS_PER_DAY);
}

/** The line-1 epoch as the radio reports it in LIST (whole seconds; integer arithmetic). Null when unparseable. */
export function radioFoundryTleEpochSeconds(line1: string): number | null {
  if (line1.length < 32) return null;
  const yyStr = line1.slice(18, 20);
  const dddStr = line1.slice(20, 23);
  if (line1[23] !== '.') return null;
  const fracStr = line1.slice(24, 32);
  if (!/^\d+$/.test(yyStr) || !/^\d+$/.test(dddStr) || !/^\d+$/.test(fracStr)) return null;
  const yy = Number(yyStr);
  const ddd = Number(dddStr);
  const frac = Number(fracStr);
  const year = yy >= 57 ? 1900 + yy : 2000 + yy;
  const jan1Days = daysSinceEpochToYearStart(year);
  const dayIndex = jan1Days + ddd - 1;
  const secFromFracDay = Math.floor(frac / 1_000_000) * 864 + Math.floor(((frac % 1_000_000) * 864) / 1_000_000);
  return dayIndex * 86_400 + secFromFracDay;
}
/**
 * OpenGD77 zone bank encode/decode.
 * Cite: docs/reference/radios/opengd77/contacts-zones-lists.md;
 * qdmr ZoneElement / ZoneBankElement (facts only).
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioZoneDto } from '../../radioWriteProjection.ts';
import {
  OPENGD77_ZONE_BANK_SIZE,
  OPENGD77_ZONE_BANK_ZONES,
  OPENGD77_ZONE_COUNT,
  OPENGD77_ZONE_MEMBERS,
  OPENGD77_ZONE_NAME_LEN,
  OPENGD77_ZONE_SIZE,
  OPENUV380_OFFSET,
} from './constants.ts';
import { readAbs, writeAbs } from './memory.ts';

const TE = new TextEncoder();

function encodeName(name: string): Uint8Array {
  const out = new Uint8Array(OPENGD77_ZONE_NAME_LEN);
  out.fill(0xff);
  const bytes = TE.encode((name || '').trim().slice(0, OPENGD77_ZONE_NAME_LEN));
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i]!;
  return out;
}

function decodeName(raw: Uint8Array): string {
  let name = '';
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!;
    if (c === 0xff || c === 0x00) break;
    name += String.fromCharCode(c < 32 ? 32 : c);
  }
  return name.replace(/\s+$/, '');
}

function setU16Le(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >> 8) & 0xff;
}

function getU16Le(buf: Uint8Array, offset: number): number {
  return (buf[offset]! | (buf[offset + 1]! << 8)) & 0xffff;
}

function setBankBit(bank: Uint8Array, index: number, enabled: boolean): void {
  const byte = Math.floor(index / 8);
  const bit = index % 8;
  if (enabled) bank[byte] = bank[byte]! | (1 << bit);
  else bank[byte] = bank[byte]! & ~(1 << bit);
}

function bankBitEnabled(bank: Uint8Array, index: number): boolean {
  const byte = Math.floor(index / 8);
  const bit = index % 8;
  return ((bank[byte]! >> bit) & 1) === 1;
}

export function encodeZoneRecord(zone: RadioZoneDto): Uint8Array {
  const out = new Uint8Array(OPENGD77_ZONE_SIZE);
  out.fill(0x00);
  out.set(encodeName(zone.wireName), 0);
  const members = zone.channelNumbers.slice(0, OPENGD77_ZONE_MEMBERS);
  for (let i = 0; i < OPENGD77_ZONE_MEMBERS; i++) {
    const ch = members[i];
    setU16Le(out, 0x10 + i * 2, ch != null && ch > 0 ? ch : 0);
  }
  return out;
}

export function decodeZoneRecord(raw: Uint8Array): RadioZoneDto | null {
  const wireName = decodeName(raw.subarray(0, OPENGD77_ZONE_NAME_LEN));
  if (!wireName) return null;
  const channelNumbers: number[] = [];
  for (let i = 0; i < OPENGD77_ZONE_MEMBERS; i++) {
    const wire = getU16Le(raw, 0x10 + i * 2);
    if (wire === 0) break;
    channelNumbers.push(wire);
  }
  return { wireName, channelNumbers };
}

/** Replace zone bank from projection (clears unlisted slots). */
export function encodeZonesIntoImage(image: MemoryMap, zones: readonly RadioZoneDto[]): void {
  const bank = new Uint8Array(OPENGD77_ZONE_BANK_SIZE);
  bank.fill(0x00);
  const n = Math.min(zones.length, OPENGD77_ZONE_COUNT);
  for (let i = 0; i < n; i++) {
    setBankBit(bank, i, true);
    bank.set(encodeZoneRecord(zones[i]!), OPENGD77_ZONE_BANK_ZONES + i * OPENGD77_ZONE_SIZE);
  }
  writeAbs(image, OPENUV380_OFFSET.zoneBank, bank);
}

export function decodeZonesFromImage(image: MemoryMap): RadioZoneDto[] {
  const bank = readAbs(image, OPENUV380_OFFSET.zoneBank, OPENGD77_ZONE_BANK_SIZE);
  const out: RadioZoneDto[] = [];
  for (let i = 0; i < OPENGD77_ZONE_COUNT; i++) {
    if (!bankBitEnabled(bank, i)) continue;
    const off = OPENGD77_ZONE_BANK_ZONES + i * OPENGD77_ZONE_SIZE;
    const zone = decodeZoneRecord(bank.subarray(off, off + OPENGD77_ZONE_SIZE));
    if (zone) out.push(zone);
  }
  return out;
}

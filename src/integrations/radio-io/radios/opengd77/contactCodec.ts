/**
 * OpenGD77 DMR contact bank encode/decode (0x18 records).
 * Cite: docs/reference/radios/opengd77/contacts-zones-lists.md;
 * qdmr ContactElement (facts only).
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioDigitalContactDto, RadioTalkGroupDto } from '../../radioWriteProjection.ts';
import {
  OPENGD77_CONTACT_COUNT,
  OPENGD77_CONTACT_NAME_LEN,
  OPENGD77_CONTACT_SIZE,
  OPENUV380_OFFSET,
} from './constants.ts';
import { encodeBcd8Le } from './channelCodec.ts';
import { readAbs, writeAbs } from './memory.ts';

const TE = new TextEncoder();

/** Unified contact for OpenGD77 bank (1-based index). */
export interface OpenGd77ContactDto {
  /** 1-based contact index in the radio bank. */
  index: number;
  wireName: string;
  digitalId: number;
  /** OpenGD77 wire: 0 group, 1 private, 2 all-call. */
  callType: number;
}

function encodeName(name: string, maxLen: number): Uint8Array {
  const out = new Uint8Array(maxLen);
  out.fill(0xff);
  const bytes = TE.encode((name || '').trim().slice(0, maxLen));
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

/** BCD8 big-endian (qdmr getBCD8_be / setBCD8_be). */
export function decodeBcd8Be(bytes: Uint8Array): number {
  if (bytes.length < 4) return 0;
  const val = ((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0;
  return (
    (val & 0xf) +
    ((val >> 4) & 0xf) * 10 +
    ((val >> 8) & 0xf) * 100 +
    ((val >> 12) & 0xf) * 1000 +
    ((val >> 16) & 0xf) * 10_000 +
    ((val >> 20) & 0xf) * 100_000 +
    ((val >> 24) & 0xf) * 1_000_000 +
    ((val >> 28) & 0xf) * 10_000_000
  );
}

export function encodeBcd8Be(value: number): Uint8Array {
  // Same digit packing as LE, then store as BE via setUInt32_be layout.
  const le = encodeBcd8Le(value);
  // encodeBcd8Le produces little-endian byte order of the packed u32.
  // For BE we need the opposite byte order of that packed value.
  const packed = le[0]! | (le[1]! << 8) | (le[2]! << 16) | (le[3]! << 24);
  return new Uint8Array([
    (packed >>> 24) & 0xff,
    (packed >>> 16) & 0xff,
    (packed >>> 8) & 0xff,
    packed & 0xff,
  ]);
}

export function encodeContactRecord(dto: OpenGd77ContactDto): Uint8Array {
  const out = new Uint8Array(OPENGD77_CONTACT_SIZE);
  out.fill(0xff);
  out.set(encodeName(dto.wireName, OPENGD77_CONTACT_NAME_LEN), 0);
  out.set(encodeBcd8Be(dto.digitalId >>> 0), 0x10);
  out[0x14] = dto.callType & 0xff;
  out[0x15] = 0xff;
  out[0x16] = 0xff;
  out[0x17] = 0x01; // TimeSlotOverride::None
  return out;
}

export function decodeContactRecord(
  raw: Uint8Array,
  index1Based: number,
): OpenGd77ContactDto | null {
  if (raw.length < OPENGD77_CONTACT_SIZE) return null;
  const wireName = decodeName(raw.subarray(0, OPENGD77_CONTACT_NAME_LEN));
  if (!wireName) return null;
  return {
    index: index1Based,
    wireName,
    digitalId: decodeBcd8Be(raw.subarray(0x10, 0x14)),
    callType: raw[0x14]!,
  };
}

/** Merge talk groups (group call) + digital contacts (private) into bank slots. */
export function mergeOrganisationContacts(
  talkGroups: readonly RadioTalkGroupDto[] | undefined,
  digitalContacts: readonly RadioDigitalContactDto[] | undefined,
): OpenGd77ContactDto[] {
  const out: OpenGd77ContactDto[] = [];
  const used = new Set<number>();

  for (const tg of talkGroups ?? []) {
    const index = tg.index >= 1 ? tg.index : out.length + 1;
    if (used.has(index) || index > OPENGD77_CONTACT_COUNT) continue;
    used.add(index);
    out.push({
      index,
      wireName: tg.wireName,
      digitalId: tg.digitalId,
      callType: 0, // OpenGD77 group call
    });
  }

  let next = 1;
  for (const c of digitalContacts ?? []) {
    while (used.has(next) && next <= OPENGD77_CONTACT_COUNT) next++;
    if (next > OPENGD77_CONTACT_COUNT) break;
    used.add(next);
    out.push({
      index: next,
      wireName: c.wireName || c.callsign || `ID${c.digitalId}`,
      digitalId: c.digitalId,
      callType: 1, // private
    });
    next++;
  }

  return out.sort((a, b) => a.index - b.index);
}

/** Replace the entire DMR contact bank from organisation contacts. */
export function encodeContactsIntoImage(
  image: MemoryMap,
  contacts: readonly OpenGd77ContactDto[],
): void {
  const bankSize = OPENGD77_CONTACT_COUNT * OPENGD77_CONTACT_SIZE;
  const bank = new Uint8Array(bankSize);
  bank.fill(0xff);
  const byIndex = new Map(contacts.map((c) => [c.index, c]));
  for (let i = 0; i < OPENGD77_CONTACT_COUNT; i++) {
    const dto = byIndex.get(i + 1);
    const off = i * OPENGD77_CONTACT_SIZE;
    if (dto) {
      bank.set(encodeContactRecord(dto), off);
    }
  }
  writeAbs(image, OPENUV380_OFFSET.contacts, bank);
}

export function decodeContactsFromImage(image: MemoryMap): OpenGd77ContactDto[] {
  const bank = readAbs(
    image,
    OPENUV380_OFFSET.contacts,
    OPENGD77_CONTACT_COUNT * OPENGD77_CONTACT_SIZE,
  );
  const out: OpenGd77ContactDto[] = [];
  for (let i = 0; i < OPENGD77_CONTACT_COUNT; i++) {
    const off = i * OPENGD77_CONTACT_SIZE;
    const decoded = decodeContactRecord(bank.subarray(off, off + OPENGD77_CONTACT_SIZE), i + 1);
    if (decoded) out.push(decoded);
  }
  return out;
}

/** Build digitalId → 1-based contact index map from encoded contacts. */
export function contactIndexByDigitalId(
  contacts: readonly OpenGd77ContactDto[],
): Map<number, number> {
  const map = new Map<number, number>();
  for (const c of contacts) {
    if (!map.has(c.digitalId)) map.set(c.digitalId, c.index);
  }
  return map;
}

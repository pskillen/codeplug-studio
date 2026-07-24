/**
 * OpenGD77 RX group list bank encode/decode.
 * Cite: docs/reference/radios/opengd77/contacts-zones-lists.md;
 * qdmr GroupListElement / GroupListBankElement (facts only).
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioRxGroupDto } from '../../radioWriteProjection.ts';
import {
  OPENGD77_RX_GROUP_BANK_SIZE,
  OPENGD77_RX_GROUP_COUNT,
  OPENGD77_RX_GROUP_LENGTH_TABLE,
  OPENGD77_RX_GROUP_LISTS_START,
  OPENGD77_RX_GROUP_MEMBERS,
  OPENGD77_RX_GROUP_NAME_LEN,
  OPENGD77_RX_GROUP_SIZE,
  OPENUV380_OFFSET,
} from './constants.ts';
import { readAbs, writeAbs } from './memory.ts';

const TE = new TextEncoder();

function encodeName(name: string): Uint8Array {
  const out = new Uint8Array(OPENGD77_RX_GROUP_NAME_LEN);
  out.fill(0xff);
  const bytes = TE.encode((name || '').trim().slice(0, OPENGD77_RX_GROUP_NAME_LEN));
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

/**
 * Encode RX groups. Members are contact indices (1-based on wire) resolved from
 * `contactIndexById` (digitalId → 1-based contact index).
 */
export function encodeRxGroupsIntoImage(
  image: MemoryMap,
  groups: readonly RadioRxGroupDto[],
  contactIndexById: ReadonlyMap<number, number>,
): void {
  const bank = new Uint8Array(OPENGD77_RX_GROUP_BANK_SIZE);
  bank.fill(0x00);
  // Name pad in cleared lists uses 0xff
  for (let i = 0; i < OPENGD77_RX_GROUP_COUNT; i++) {
    const listOff = OPENGD77_RX_GROUP_LISTS_START + i * OPENGD77_RX_GROUP_SIZE;
    bank.fill(0xff, listOff, listOff + OPENGD77_RX_GROUP_NAME_LEN + 1);
  }

  for (const g of groups) {
    const idx0 = g.index >= 1 ? g.index - 1 : -1;
    if (idx0 < 0 || idx0 >= OPENGD77_RX_GROUP_COUNT) continue;
    const listOff = OPENGD77_RX_GROUP_LISTS_START + idx0 * OPENGD77_RX_GROUP_SIZE;
    const record = new Uint8Array(OPENGD77_RX_GROUP_SIZE);
    record.fill(0x00);
    record.set(encodeName(g.wireName), 0);
    const memberIds = g.memberDigitalIds.slice(0, OPENGD77_RX_GROUP_MEMBERS);
    let count = 0;
    for (let i = 0; i < OPENGD77_RX_GROUP_MEMBERS; i++) {
      const dig = memberIds[i];
      if (dig == null) {
        setU16Le(record, 0x10 + i * 2, 0);
        continue;
      }
      const contactIdx = contactIndexById.get(dig);
      if (contactIdx == null || contactIdx < 1) {
        setU16Le(record, 0x10 + i * 2, 0);
        continue;
      }
      setU16Le(record, 0x10 + i * 2, contactIdx);
      count++;
    }
    bank.set(record, listOff);
    // length table: count+1 when present (qdmr setGroupListContactCount)
    bank[OPENGD77_RX_GROUP_LENGTH_TABLE + idx0] = (count + 1) & 0xff;
  }
  writeAbs(image, OPENUV380_OFFSET.groupLists, bank);
}

export function decodeRxGroupsFromImage(
  image: MemoryMap,
  contactsByIndex: ReadonlyMap<number, number>,
): RadioRxGroupDto[] {
  const bank = readAbs(image, OPENUV380_OFFSET.groupLists, OPENGD77_RX_GROUP_BANK_SIZE);
  const out: RadioRxGroupDto[] = [];
  for (let i = 0; i < OPENGD77_RX_GROUP_COUNT; i++) {
    const lenWire = bank[OPENGD77_RX_GROUP_LENGTH_TABLE + i]!;
    if (lenWire === 0) continue;
    const listOff = OPENGD77_RX_GROUP_LISTS_START + i * OPENGD77_RX_GROUP_SIZE;
    const record = bank.subarray(listOff, listOff + OPENGD77_RX_GROUP_SIZE);
    const wireName = decodeName(record.subarray(0, OPENGD77_RX_GROUP_NAME_LEN));
    if (!wireName) continue;
    const memberDigitalIds: number[] = [];
    const memberCount = Math.max(0, lenWire - 1);
    for (let m = 0; m < Math.min(memberCount, OPENGD77_RX_GROUP_MEMBERS); m++) {
      const contactIdx = getU16Le(record, 0x10 + m * 2);
      if (contactIdx === 0) break;
      const dig = contactsByIndex.get(contactIdx);
      if (dig != null) memberDigitalIds.push(dig);
    }
    out.push({ index: i + 1, wireName, memberDigitalIds });
  }
  return out;
}

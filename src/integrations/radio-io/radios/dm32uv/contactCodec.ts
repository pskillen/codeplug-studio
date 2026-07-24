/**
 * DM-32UV digital address-book encode — V-frame 0x0F range (92-byte entries).
 * Cite: NeonPlug encodeContactEntry / writeContacts; tier-3 contacts-zones-lists.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import { DM32_BLOCK_SIZE } from './constants.ts';

export const DM32_CONTACT_ENTRY_SIZE = 0x5c; // 92
export const DM32_CONTACTS_PER_BLOCK = 44;

const TE = new TextEncoder();

function writePaddedField(data: Uint8Array, offset: number, maxLen: number, text: string): void {
  data.fill(0xff, offset, offset + maxLen);
  const bytes = TE.encode(text.slice(0, maxLen - 1));
  data.set(bytes, offset);
  data[offset + bytes.length] = 0x00;
}

/** Encode one 92-byte digital contact entry. */
export function encodeDm32ContactEntry(contact: RadioDigitalContactDto): Uint8Array {
  const data = new Uint8Array(DM32_CONTACT_ENTRY_SIZE);
  data.fill(0xff);
  writePaddedField(data, 0x00, 16, contact.wireName);
  const id = contact.digitalId >>> 0;
  data[0x10] = id & 0xff;
  data[0x11] = (id >>> 8) & 0xff;
  data[0x12] = (id >>> 16) & 0xff;
  data[0x13] = (id >>> 24) & 0xff;
  writePaddedField(data, 0x14, 8, contact.callsign);
  writePaddedField(data, 0x1c, 16, contact.city);
  writePaddedField(data, 0x2c, 16, contact.province);
  writePaddedField(data, 0x3c, 16, contact.country);
  writePaddedField(data, 0x4c, 16, contact.remark);
  return data;
}

export interface Dm32ContactEncodeContext {
  addressBase: number;
  /** Absolute start of contact bank (from V-frame 0x0F). */
  contactsBase: number;
  /** Absolute end of contact bank (from V-frame 0x0F), when known. */
  contactsEnd?: number;
  discoveredAddresses: readonly number[];
}

function contactBlockSpan(ctx: Dm32ContactEncodeContext): {
  firstBlockAddr: number;
  blockCount: number;
} {
  const firstBlockAddr = Math.floor(ctx.contactsBase / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
  const endAddr = ctx.contactsEnd ?? ctx.contactsBase;
  const lastBlockAddr = Math.floor(endAddr / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
  const blockCount = Math.max(1, Math.floor((lastBlockAddr - firstBlockAddr) / DM32_BLOCK_SIZE) + 1);
  return { firstBlockAddr, blockCount };
}

function clearContactEntriesInBlock(
  image: MemoryMap,
  mapOff: number,
  isFirstBlock: boolean,
): void {
  for (let i = 0; i < DM32_CONTACTS_PER_BLOCK; i++) {
    const entryOff = isFirstBlock ? 0x10 + i * DM32_CONTACT_ENTRY_SIZE : i * DM32_CONTACT_ENTRY_SIZE;
    if (entryOff + DM32_CONTACT_ENTRY_SIZE <= DM32_BLOCK_SIZE - 1) {
      image.bytes.fill(0xff, mapOff + entryOff, mapOff + entryOff + DM32_CONTACT_ENTRY_SIZE);
    }
  }
}

/**
 * Pack digital contacts into contact-bank blocks present in the MemoryMap.
 * Clears every entry slot in the V-frame contact span before writing so shrink
 * cannot leave stale entries in earlier blocks.
 */
export function encodeDigitalContactsIntoDm32Image(
  image: MemoryMap,
  ctx: Dm32ContactEncodeContext,
  contacts: readonly RadioDigitalContactDto[],
): MemoryMap {
  const { firstBlockAddr, blockCount } = contactBlockSpan(ctx);
  const firstMapOff = firstBlockAddr - ctx.addressBase;
  if (firstMapOff < 0 || firstMapOff + DM32_BLOCK_SIZE > image.size) {
    return image;
  }

  const countOffsetInFirst = ctx.contactsBase - firstBlockAddr;
  const n = contacts.length;
  image.bytes[firstMapOff + countOffsetInFirst] = n & 0xff;
  image.bytes[firstMapOff + countOffsetInFirst + 1] = (n >>> 8) & 0xff;
  image.bytes[firstMapOff + countOffsetInFirst + 2] = (n >>> 16) & 0xff;
  image.bytes[firstMapOff + countOffsetInFirst + 3] = (n >>> 24) & 0xff;
  for (let i = 0; i < 12; i++) {
    image.bytes[firstMapOff + countOffsetInFirst + 4 + i] = 0x00;
  }

  for (let blockNum = 0; blockNum < blockCount; blockNum++) {
    const blockAddr = firstBlockAddr + blockNum * DM32_BLOCK_SIZE;
    const mapOff = blockAddr - ctx.addressBase;
    if (mapOff < 0 || mapOff + DM32_BLOCK_SIZE > image.size) continue;

    const isFirstBlock = blockNum === 0;
    clearContactEntriesInBlock(image, mapOff, isFirstBlock);

    const firstContactIndex = blockNum * DM32_CONTACTS_PER_BLOCK;
    const lastContactIndex = Math.min(
      contacts.length - 1,
      (blockNum + 1) * DM32_CONTACTS_PER_BLOCK - 1,
    );
    if (lastContactIndex < firstContactIndex) continue;

    for (let contactIndex = firstContactIndex; contactIndex <= lastContactIndex; contactIndex++) {
      const indexInBlock = contactIndex % DM32_CONTACTS_PER_BLOCK;
      const entryOff = isFirstBlock
        ? 0x10 + indexInBlock * DM32_CONTACT_ENTRY_SIZE
        : indexInBlock * DM32_CONTACT_ENTRY_SIZE;
      image.set(mapOff + entryOff, encodeDm32ContactEntry(contacts[contactIndex]!));
    }
  }

  return image;
}

/** Parse V-frame 0x0F payload → contact absolute start/end. */
export function parseDm32ContactsRange(payload: Uint8Array): { start: number; end: number } | null {
  if (payload.length < 8) return null;
  const start = payload[0]! | (payload[1]! << 8) | (payload[2]! << 16) | (payload[3]! << 24);
  const end = payload[4]! | (payload[5]! << 8) | (payload[6]! << 16) | (payload[7]! << 24);
  if (start === 0 && end === 0) return null;
  return { start: start >>> 0, end: end >>> 0 };
}

/**
 * DM-32UV digital address-book encode — V-frame 0x0F range (92-byte entries).
 * Cite: NeonPlug encodeContactEntry / writeContacts; tier-3 contacts-zones-lists.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioDigitalContactDto } from '../../radioWriteProjection.ts';
import { DM32_BLOCK_SIZE, DM32_LIMITS } from './constants.ts';

export const DM32_CONTACT_ENTRY_SIZE = 0x5c; // 92
export const DM32_CONTACTS_PER_BLOCK = DM32_LIMITS.ADDRESS_BOOK_CONTACTS_PER_BLOCK;

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

function contactBlockSpan(
  ctx: Dm32ContactEncodeContext,
  contactCount: number,
): {
  firstBlockAddr: number;
  blockCount: number;
} {
  const firstBlockAddr = Math.floor(ctx.contactsBase / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
  // NeonPlug writeContacts: only pack ceil(n/44) blocks — never the full V-frame end
  // (L01 end can be near 0xFFF000 and would clear/allocate thousands of empty blocks).
  const needed = Math.max(1, Math.ceil(Math.max(contactCount, 1) / DM32_CONTACTS_PER_BLOCK));
  let blockCount = needed;
  if (ctx.contactsEnd != null && ctx.contactsEnd > ctx.contactsBase) {
    const lastBlockAddr = Math.floor(ctx.contactsEnd / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
    const spanBlocks = Math.floor((lastBlockAddr - firstBlockAddr) / DM32_BLOCK_SIZE) + 1;
    if (spanBlocks > 0 && spanBlocks <= DM32_LIMITS.CONTACT_BANK_MAX_BLOCKS) {
      // Trusted small span: clear the whole bank so shrink cannot leave stale entries.
      blockCount = Math.max(needed, spanBlocks);
    }
  }
  blockCount = Math.min(blockCount, DM32_LIMITS.CONTACT_BANK_MAX_BLOCKS);
  return { firstBlockAddr, blockCount };
}

function clearContactEntriesInBlock(image: MemoryMap, mapOff: number, isFirstBlock: boolean): void {
  for (let i = 0; i < DM32_CONTACTS_PER_BLOCK; i++) {
    const entryOff = isFirstBlock
      ? 0x10 + i * DM32_CONTACT_ENTRY_SIZE
      : i * DM32_CONTACT_ENTRY_SIZE;
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
  const { firstBlockAddr, blockCount } = contactBlockSpan(ctx, contacts.length);
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

/** Parse V-frame 0x10 payload → max contact count (u32 LE). */
export function parseDm32MaxContacts(payload: Uint8Array): number | null {
  if (payload.length < 4) return null;
  const n = payload[0]! | (payload[1]! << 8) | (payload[2]! << 16) | (payload[3]! << 24);
  if (n <= 0) return null;
  return n >>> 0;
}

/** NeonPlug firmware.ts — L01 = 150k, else 50k. */
export function dm32MaxContactsFromFirmware(firmware: string | undefined): number {
  if (firmware?.includes('L01')) return DM32_LIMITS.CONTACT_MAX_L01;
  return DM32_LIMITS.CONTACT_MAX_DEFAULT;
}

export interface Dm32ContactBankReadPlan {
  firstBlockAddr: number;
  /** Absolute addresses of 4KB blocks to read (count-based, capped). */
  blockAddresses: number[];
  contactCount: number;
}

/**
 * Plan which contact-bank blocks to download.
 * Cite: NeonPlug readContacts — header count first; never walk the full V-frame end.
 */
export function planDm32ContactBankBlocks(args: {
  contactsBase: number;
  contactsEnd?: number;
  /** u32 count from the first contact block header. */
  countFromHeader: number;
  maxContacts: number;
}): Dm32ContactBankReadPlan {
  const firstBlockAddr = Math.floor(args.contactsBase / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
  const maxContacts = Math.max(0, Math.min(args.maxContacts, DM32_LIMITS.CONTACT_MAX_L01));
  const maxByBlocks = DM32_LIMITS.CONTACT_BANK_MAX_BLOCKS * DM32_CONTACTS_PER_BLOCK;

  let maxInRange = maxByBlocks;
  if (args.contactsEnd != null && args.contactsEnd > args.contactsBase) {
    const rangeBytes = args.contactsEnd - args.contactsBase + 1;
    const fromRange = Math.floor(rangeBytes / DM32_CONTACT_ENTRY_SIZE);
    const rangeBlocks =
      Math.floor(
        (Math.floor(args.contactsEnd / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE - firstBlockAddr) /
          DM32_BLOCK_SIZE,
      ) + 1;
    // Only trust range sizing when the span is within the hard block cap.
    if (rangeBlocks > 0 && rangeBlocks <= DM32_LIMITS.CONTACT_BANK_MAX_BLOCKS) {
      maxInRange = Math.min(fromRange, maxByBlocks);
    }
  }

  const header = args.countFromHeader >>> 0;
  // Valid header wins. Zero or out-of-range → header block only.
  // Do not fall back to min(maxContacts, V-frame span) — L01 end addresses near
  // 0xFFF000 caused a 3464-block download runaway when the full span was walked.
  const contactCount = header > 0 && header <= maxContacts && header <= maxInRange ? header : 0;

  const blocksNeeded = contactCount <= 0 ? 1 : Math.ceil(contactCount / DM32_CONTACTS_PER_BLOCK);
  const blockCount = Math.min(Math.max(1, blocksNeeded), DM32_LIMITS.CONTACT_BANK_MAX_BLOCKS);

  const blockAddresses: number[] = [];
  for (let i = 0; i < blockCount; i++) {
    blockAddresses.push(firstBlockAddr + i * DM32_BLOCK_SIZE);
  }
  return { firstBlockAddr, blockAddresses, contactCount };
}

/**
 * Address-book 4KB blocks to allocate/write for a known contact count.
 * Never walks V-frame `contactsEnd` (L01 runaway).
 */
export function planDm32ContactBankWriteBlocks(
  contactsBase: number,
  contactCount: number,
): number[] {
  const firstBlockAddr = Math.floor(contactsBase / DM32_BLOCK_SIZE) * DM32_BLOCK_SIZE;
  const needed = Math.max(1, Math.ceil(Math.max(contactCount, 0) / DM32_CONTACTS_PER_BLOCK));
  const blockCount = Math.min(needed, DM32_LIMITS.CONTACT_BANK_MAX_BLOCKS);
  const blockAddresses: number[] = [];
  for (let i = 0; i < blockCount; i++) {
    blockAddresses.push(firstBlockAddr + i * DM32_BLOCK_SIZE);
  }
  return blockAddresses;
}

/** Read u32 LE contact count at contactsBase within a first-block buffer. */
export function readDm32ContactCountFromBlock(
  firstBlock: Uint8Array,
  contactsBase: number,
  firstBlockAddr: number,
): number {
  const off = contactsBase - firstBlockAddr;
  if (off < 0 || off + 4 > firstBlock.length) return 0;
  return (
    (firstBlock[off]! |
      (firstBlock[off + 1]! << 8) |
      (firstBlock[off + 2]! << 16) |
      (firstBlock[off + 3]! << 24)) >>>
    0
  );
}

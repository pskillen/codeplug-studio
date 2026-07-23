/**
 * DM-32UV talk-group encode — metadata 0x44 + counter 0x06 + quick-access 0x0B.
 * Cite: NeonPlug encodeQuickContacts / writeQuickContacts; tier-3 contacts-zones-lists.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioTalkGroupDto } from '../../radioWriteProjection.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET, DM32_OFFSET } from './constants.ts';

const TE = new TextEncoder();

const CALL_TYPE_PRIVATE = 0x03;
const CALL_TYPE_GROUP = 0x04;
const CALL_TYPE_ALL = 0x05;

function findBlock(
  discovered: readonly { address: number; metadata: number }[],
  metadata: number,
): { address: number } | undefined {
  return discovered.find((b) => b.metadata === metadata);
}

function writeAscii16(dest: Uint8Array, offset: number, text: string): void {
  dest.fill(0, offset, offset + 16);
  const bytes = TE.encode(text.slice(0, 15));
  dest.set(bytes, offset);
}

/**
 * Pack quick-contacts into a fresh 0x44 block.
 * First entry is 25 bytes (leading 0x00); later entries 24 bytes; trailing empty sentinel.
 */
export function encodeDm32TalkGroupBlock(talkGroups: readonly RadioTalkGroupDto[]): Uint8Array {
  const data = new Uint8Array(DM32_BLOCK_SIZE);
  data.fill(0x00);
  data[DM32_METADATA_OFFSET] = DM32_METADATA.TALK_GROUPS;

  const list =
    talkGroups.length > 0
      ? talkGroups
      : [
          {
            index: 1,
            wireName: 'All',
            digitalId: 0xffffff,
            callType: CALL_TYPE_ALL,
          } satisfies RadioTalkGroupDto,
        ];

  let offset = 0;
  for (let i = 0; i < list.length; i++) {
    const tg = list[i]!;
    if (i === 0) {
      data[offset++] = 0x00; // header on first entry only
    }
    data[offset++] = 0x00; // flag
    writeAscii16(data, offset, tg.wireName);
    offset += 16;
    data[offset++] = 0x00; // null after name
    const id = tg.digitalId >>> 0;
    data[offset++] = id & 0xff;
    data[offset++] = (id >>> 8) & 0xff;
    data[offset++] = (id >>> 16) & 0xff;
    data[offset++] = (tg.callType || CALL_TYPE_GROUP) & 0xff;
    data[offset++] = 0x00;
    data[offset++] = 0x00;
  }
  // Empty sentinel entry (24 bytes of 0 already)
  return data;
}

function patchTgCounter(image: MemoryMap, addressBase: number, address: number, count: number): void {
  const base = address - addressBase;
  image.bytes[base + DM32_OFFSET.TALK_GROUP_COUNTER] = count & 0xff;
  image.bytes[base + DM32_METADATA_OFFSET] = DM32_METADATA.CONFIG_TG_COUNTER;
}

function typeByte(callType: number): number {
  if (callType === CALL_TYPE_PRIVATE) return 0x30;
  if (callType === CALL_TYPE_ALL) return 0x50;
  return 0x40;
}

function patchQuickAccess(
  image: MemoryMap,
  addressBase: number,
  address: number,
  talkGroups: readonly RadioTalkGroupDto[],
): void {
  const base = address - addressBase;
  const block = image.bytes.subarray(base, base + DM32_BLOCK_SIZE);
  const list =
    talkGroups.length > 0
      ? talkGroups
      : [{ index: 1, wireName: 'All', digitalId: 0xffffff, callType: CALL_TYPE_ALL }];

  block[0] = list.length & 0xff;
  block[1] = (list.length >>> 8) & 0xff;
  const groupCount = list.filter((t) => (t.callType || CALL_TYPE_GROUP) === CALL_TYPE_GROUP).length;
  const privateCount = list.filter((t) => t.callType === CALL_TYPE_PRIVATE).length;
  block[2] = groupCount & 0xff;
  block[3] = (groupCount >>> 8) & 0xff;
  block[4] = privateCount & 0xff;

  block.fill(0xff, 0x10, 0x20);
  for (let i = 0; i < list.length && i < 128; i++) {
    const byteIndex = 0x10 + Math.floor(i / 8);
    const bit = i % 8;
    block[byteIndex]! &= ~(1 << bit);
  }

  block.fill(0xff, 0x100, 0x700);
  const byName = [...list.keys()].sort((a, b) =>
    list[a]!.wireName.localeCompare(list[b]!.wireName, undefined, { sensitivity: 'base' }),
  );
  for (let i = 0; i < byName.length; i++) {
    const idx = byName[i]!;
    const off = 0x100 + i * 2;
    block[off] = (idx + 1) & 0xff;
    block[off + 1] = typeByte(list[idx]!.callType || CALL_TYPE_GROUP);
  }

  block.fill(0xff, 0x740, 0xd00);
  const byId = [...list.keys()].sort((a, b) => list[a]!.digitalId - list[b]!.digitalId);
  for (let i = 0; i < byId.length; i++) {
    const idx = byId[i]!;
    const off = 0x740 + i * 2;
    block[off] = (idx + 1) & 0xff;
    block[off + 1] = typeByte(list[idx]!.callType || CALL_TYPE_GROUP);
  }

  block[DM32_METADATA_OFFSET] = DM32_METADATA.METADATA_0x0B;
}

export interface Dm32TalkGroupEncodeContext {
  addressBase: number;
  discovered: readonly { address: number; metadata: number }[];
}

export function encodeTalkGroupsIntoDm32Image(
  image: MemoryMap,
  ctx: Dm32TalkGroupEncodeContext,
  talkGroups: readonly RadioTalkGroupDto[],
): MemoryMap {
  const counter = findBlock(ctx.discovered, DM32_METADATA.CONFIG_TG_COUNTER);
  const tgBlock = findBlock(ctx.discovered, DM32_METADATA.TALK_GROUPS);
  const quick = findBlock(ctx.discovered, DM32_METADATA.METADATA_0x0B);

  const count = talkGroups.length > 0 ? talkGroups.length : 1;
  if (counter) patchTgCounter(image, ctx.addressBase, counter.address, count);
  if (tgBlock) {
    const packed = encodeDm32TalkGroupBlock(talkGroups);
    image.set(tgBlock.address - ctx.addressBase, packed);
  }
  if (quick) patchQuickAccess(image, ctx.addressBase, quick.address, talkGroups);
  return image;
}

export { CALL_TYPE_GROUP, CALL_TYPE_PRIVATE, CALL_TYPE_ALL };

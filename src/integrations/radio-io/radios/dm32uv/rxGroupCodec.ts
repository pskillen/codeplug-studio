/**
 * DM-32UV RX group list encode — metadata 0x0F (config, not V-frame contacts).
 * Cite: NeonPlug encodeRXGroups; tier-3 contacts-zones-lists.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioRxGroupDto } from '../../radioWriteProjection.ts';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET, DM32_LIMITS } from './constants.ts';

export const DM32_RX_GROUP_ENTRY_SIZE = 109;
export const DM32_RX_GROUPS_MAX = DM32_LIMITS.RX_GROUPS_MAX;

/** Offset of the 4-byte store marker in the RX-group page (MM9PDY firmware, decision D58). */
export const DM32_RX_SLOT_MARKER_OFFSET = 0xdfc;
export const DM32_RX_SLOT_MARKER = [0x54, 0x53, 0x01, 0x00] as const;
/** Group g (1-based) slot bytes live at `base + (g - 1) * DM32_RX_SLOT_BYTES_PER_GROUP`. */
export const DM32_RX_SLOT_BASE_OFFSET = 0xe00;
export const DM32_RX_SLOT_BYTES_PER_GROUP = 8;
/** Group g (1-based) check byte lives at `base + (g - 1)`. */
export const DM32_RX_SLOT_CHECK_BASE_OFFSET = 0xf00;
const DM32_RX_SLOT_CHECK_SEED = 0xa5;
const DM32_RX_MEMBER_BYTES_START = 0x0b;
const DM32_RX_MEMBER_BYTES_LENGTH = 96;

const TE = new TextEncoder();

function slotCode(slot: 1 | 2 | undefined): number {
  return slot === 1 ? 0b01 : slot === 2 ? 0b10 : 0b00;
}

/** `0xA5` XOR the group's 96 member bytes, as written in the page. */
function rxGroupSlotCheck(page: Uint8Array, groupIndex0: number): number {
  const start = 0x11 + groupIndex0 * DM32_RX_GROUP_ENTRY_SIZE + DM32_RX_MEMBER_BYTES_START;
  let check = DM32_RX_SLOT_CHECK_SEED;
  for (let i = 0; i < DM32_RX_MEMBER_BYTES_LENGTH; i++) check ^= page[start + i]!;
  return check;
}

function hasSlotMarker(page: Uint8Array): boolean {
  return DM32_RX_SLOT_MARKER.every((b, i) => page[DM32_RX_SLOT_MARKER_OFFSET + i] === b);
}

/**
 * Decode the per-member timeslot store for one RX group (1-based). Positions follow
 * the record's member order (empty positions included). Returns `undefined` entries
 * for "none"; every entry is `undefined` unless the marker and the group's check match.
 */
export function decodeDm32RxGroupTimeSlotOverrides(
  page: Uint8Array,
  group: number,
): (1 | 2 | undefined)[] {
  const none = Array.from({ length: DM32UV_LIMITS.RX_GROUP_MEMBERS_MAX }, () => undefined);
  if (group < 1 || group > DM32_RX_GROUPS_MAX || !hasSlotMarker(page)) return none;
  if (page[DM32_RX_SLOT_CHECK_BASE_OFFSET + group - 1] !== rxGroupSlotCheck(page, group - 1)) {
    return none;
  }
  const base = DM32_RX_SLOT_BASE_OFFSET + (group - 1) * DM32_RX_SLOT_BYTES_PER_GROUP;
  return none.map((_, i) => {
    const code = (page[base + (i >> 2)]! >> (2 * (i & 3))) & 0b11;
    return code === 0b01 ? 1 : code === 0b10 ? 2 : undefined;
  });
}

export function encodeDm32RxGroup(group: RadioRxGroupDto): Uint8Array {
  const data = new Uint8Array(DM32_RX_GROUP_ENTRY_SIZE);
  data.fill(0x00);
  const name = TE.encode(group.wireName.slice(0, 10));
  data.set(name, 0);
  data[name.length] = 0;

  const members = group.memberDigitalIds.slice(0, DM32UV_LIMITS.RX_GROUP_MEMBERS_MAX);
  for (let i = 0; i < members.length; i++) {
    const id = members[i]! >>> 0;
    const off = 0x0b + i * 3;
    data[off] = id & 0xff;
    data[off + 1] = (id >>> 8) & 0xff;
    data[off + 2] = (id >>> 16) & 0xff;
  }
  return data;
}

export interface Dm32RxGroupEncodeContext {
  addressBase: number;
  discovered: readonly { address: number; metadata: number }[];
}

export interface Dm32RxGroupEncodeOptions {
  /**
   * MM9PDY only. Writes {@link RadioRxGroupDto.memberTimeSlotOverrides} into the page
   * tail store. Stock writes leave the tail `0xFF` (no marker, every slot "none").
   */
  writeTimeSlotOverrides?: boolean;
}

export function encodeRxGroupsIntoDm32Image(
  image: MemoryMap,
  ctx: Dm32RxGroupEncodeContext,
  groups: readonly RadioRxGroupDto[],
  options?: Dm32RxGroupEncodeOptions,
): MemoryMap {
  const block = ctx.discovered.find((b) => b.metadata === DM32_METADATA.RX_GROUPS);
  if (!block) return image;

  const base = block.address - ctx.addressBase;
  const data = new Uint8Array(DM32_BLOCK_SIZE);
  data.fill(0xff);

  const active = groups.slice(0, DM32_RX_GROUPS_MAX);
  let mask = 0;
  for (let i = 0; i < active.length; i++) mask |= 1 << i;
  data[0] = mask & 0xff;
  data[1] = (mask >>> 8) & 0xff;
  data[2] = (mask >>> 16) & 0xff;
  data[3] = (mask >>> 24) & 0xff;
  data.fill(0x00, 4, 0x10);
  data[0x10] = 0x01;

  for (let i = 0; i < DM32_RX_GROUPS_MAX; i++) {
    const entryOff = 0x11 + i * DM32_RX_GROUP_ENTRY_SIZE;
    if (i < active.length) {
      data.set(encodeDm32RxGroup(active[i]!), entryOff);
    } else {
      data.fill(0xff, entryOff, entryOff + DM32_RX_GROUP_ENTRY_SIZE);
    }
  }

  if (
    options?.writeTimeSlotOverrides &&
    active.some((g) => g.memberTimeSlotOverrides?.some((s) => s === 1 || s === 2))
  ) {
    data.set(DM32_RX_SLOT_MARKER, DM32_RX_SLOT_MARKER_OFFSET);
    for (let g = 0; g < active.length; g++) {
      const slots = active[g]!.memberTimeSlotOverrides ?? [];
      const memberCount = Math.min(
        active[g]!.memberDigitalIds.length,
        DM32UV_LIMITS.RX_GROUP_MEMBERS_MAX,
      );
      const slotOff = DM32_RX_SLOT_BASE_OFFSET + g * DM32_RX_SLOT_BYTES_PER_GROUP;
      data.fill(0x00, slotOff, slotOff + DM32_RX_SLOT_BYTES_PER_GROUP);
      for (let i = 0; i < memberCount; i++) {
        data[slotOff + (i >> 2)]! |= slotCode(slots[i]) << (2 * (i & 3));
      }
      data[DM32_RX_SLOT_CHECK_BASE_OFFSET + g] = rxGroupSlotCheck(data, g);
    }
  }

  data[DM32_METADATA_OFFSET] = DM32_METADATA.RX_GROUPS;
  image.set(base, data);
  return image;
}

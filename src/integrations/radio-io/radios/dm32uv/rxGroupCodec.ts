/**
 * DM-32UV RX group list encode — metadata 0x0F (config, not V-frame contacts).
 * Cite: NeonPlug encodeRXGroups; tier-3 contacts-zones-lists.md.
 */

import type { MemoryMap } from '../../types.ts';
import type { RadioRxGroupDto } from '../../radioWriteProjection.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';

export const DM32_RX_GROUP_ENTRY_SIZE = 109;
export const DM32_RX_GROUPS_MAX = 32;

const TE = new TextEncoder();

export function encodeDm32RxGroup(group: RadioRxGroupDto): Uint8Array {
  const data = new Uint8Array(DM32_RX_GROUP_ENTRY_SIZE);
  data.fill(0x00);
  const name = TE.encode(group.wireName.slice(0, 10));
  data.set(name, 0);
  data[name.length] = 0;

  const members = group.memberDigitalIds.slice(0, 32);
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

export function encodeRxGroupsIntoDm32Image(
  image: MemoryMap,
  ctx: Dm32RxGroupEncodeContext,
  groups: readonly RadioRxGroupDto[],
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

  data[DM32_METADATA_OFFSET] = DM32_METADATA.RX_GROUPS;
  image.set(base, data);
  return image;
}

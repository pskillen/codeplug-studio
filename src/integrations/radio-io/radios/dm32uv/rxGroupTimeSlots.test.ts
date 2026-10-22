import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import type { RadioRxGroupDto } from '../../radioWriteProjection.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';
import {
  decodeDm32RxGroupTimeSlotOverrides,
  DM32_RX_GROUP_ENTRY_SIZE,
  encodeRxGroupsIntoDm32Image,
} from './rxGroupCodec.ts';
import { encodeDm32Mm9pdyStepKeysIntoImage } from './mm9pdyStepKeys.ts';

function writeGroups(groups: readonly RadioRxGroupDto[], writeTimeSlotOverrides: boolean) {
  const image = createMemoryMap(DM32_BLOCK_SIZE);
  const blank = new Uint8Array(DM32_BLOCK_SIZE).fill(0xff);
  blank[DM32_METADATA_OFFSET] = DM32_METADATA.RX_GROUPS;
  image.set(0, blank);
  encodeRxGroupsIntoDm32Image(
    image,
    { addressBase: 0, discovered: [{ address: 0, metadata: DM32_METADATA.RX_GROUPS }] },
    groups,
    { writeTimeSlotOverrides },
  );
  return image.bytes.slice(0, DM32_BLOCK_SIZE);
}

function group(index: number, ids: number[], slots?: (1 | 2 | undefined)[]): RadioRxGroupDto {
  return {
    index,
    wireName: `G${index}`,
    memberDigitalIds: ids,
    ...(slots ? { memberTimeSlotOverrides: slots } : {}),
  };
}

/** Eight groups; group 8 carries the firmware's `tg-mslot` slots (raw 0, 1, 4 → TS2, raw 5 → TS1). */
function eightGroups(): RadioRxGroupDto[] {
  const groups = Array.from({ length: 7 }, (_, i) => group(i + 1, [91]));
  groups.push(group(8, [2350, 91, 9, 3, 4, 5], [2, 2, undefined, undefined, 2, 1]));
  return groups;
}

describe('DM-32UV RX group per-member timeslot store', () => {
  it('writes the marker, the pinned slot bytes and the check byte for group 8', () => {
    const page = writeGroups(eightGroups(), true);
    expect([...page.subarray(0xdfc, 0xe00)]).toEqual([0x54, 0x53, 0x01, 0x00]);
    expect([...page.subarray(0xe38, 0xe40)]).toEqual([0x0a, 0x06, 0, 0, 0, 0, 0, 0]);
    let check = 0xa5;
    const start = 0x11 + 7 * DM32_RX_GROUP_ENTRY_SIZE + 0x0b;
    for (let i = 0; i < 96; i++) check ^= page[start + i]!;
    expect(page[0xf07]).toBe(check);
  });

  it('round-trips a set override and leaves groups without overrides as none', () => {
    const page = writeGroups(eightGroups(), true);
    const decoded = decodeDm32RxGroupTimeSlotOverrides(page, 8);
    expect(decoded.slice(0, 6)).toEqual([2, 2, undefined, undefined, 2, 1]);
    expect(decoded.slice(6).every((s) => s === undefined)).toBe(true);
    expect(decodeDm32RxGroupTimeSlotOverrides(page, 1).every((s) => s === undefined)).toBe(true);
  });

  it('keeps the all-FF tail on a stock write', () => {
    const page = writeGroups(eightGroups(), false);
    expect(page.subarray(0xdfc, 0xf20).every((b) => b === 0xff)).toBe(true);
    expect(decodeDm32RxGroupTimeSlotOverrides(page, 8).every((s) => s === undefined)).toBe(true);
  });

  it('keeps the all-FF tail when no member has an override', () => {
    const page = writeGroups([group(1, [91], [undefined])], true);
    expect(page.subarray(0xdfc, 0xf20).every((b) => b === 0xff)).toBe(true);
  });

  it('decodes as none when the check byte no longer matches', () => {
    const page = writeGroups(eightGroups(), true);
    page[0x11 + 7 * DM32_RX_GROUP_ENTRY_SIZE + 0x0b] ^= 0x01;
    expect(decodeDm32RxGroupTimeSlotOverrides(page, 8).every((s) => s === undefined)).toBe(true);
  });

  it('decodes as none without the marker', () => {
    const page = writeGroups(eightGroups(), true);
    page[0xdfc] = 0xff;
    expect(decodeDm32RxGroupTimeSlotOverrides(page, 8).every((s) => s === undefined)).toBe(true);
  });
});

describe('DM-32UV MM9PDY step keys', () => {
  it('sets P1 short to 20 and P2 short to 21 and nothing else', () => {
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    const block = new Uint8Array(DM32_BLOCK_SIZE).fill(0x00);
    block[DM32_METADATA_OFFSET] = DM32_METADATA.VFO_SETTINGS;
    image.set(0, block);
    encodeDm32Mm9pdyStepKeysIntoImage(image, {
      addressBase: 0,
      discovered: [{ address: 0, metadata: DM32_METADATA.VFO_SETTINGS }],
    });
    const out = image.bytes.slice(0, DM32_BLOCK_SIZE);
    expect(out[0x8d]).toBe(20);
    expect(out[0x8f]).toBe(21);
    out[0x8d] = 0;
    out[0x8f] = 0;
    expect(out).toEqual(block);
  });
});

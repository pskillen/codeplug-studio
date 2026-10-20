import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { listDescriptorsForProfile } from '../../registry.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { receiveGroupAddress, talkgroupAddress } from './memory.ts';
import {
  decodeAtD890RxGroupTimeSlotOverrides,
  encodeAtD890RxGroupRecord,
  encodeRxGroupsIntoAtD890Image,
} from './rxGroupCodec.ts';

function readU32Le(buf: Uint8Array, offset: number): number {
  return (
    (buf[offset]! |
      (buf[offset + 1]! << 8) |
      (buf[offset + 2]! << 16) |
      (buf[offset + 3]! << 24)) >>>
    0
  );
}

describe('encodeAtD890RxGroupRecord', () => {
  it('packs member talkgroup slot indices as u32 LE', () => {
    const record = encodeAtD890RxGroupRecord({
      index: 1,
      wireName: 'PRE',
      memberDigitalIds: [2, 3, 4, 5],
    });
    expect(readU32Le(record, 0)).toBe(2);
    expect(readU32Le(record, 4)).toBe(3);
    expect(readU32Le(record, 8)).toBe(4);
    expect(readU32Le(record, 12)).toBe(5);
    expect(readU32Le(record, 16)).toBe(0xffffffff);
  });

  it('keeps member 1000 as a talkgroup bank index on stock and MM9PDY', () => {
    const stock = listDescriptorsForProfile('radio-io', 'radio-io-at-d890uv');
    const mm9 = listDescriptorsForProfile('radio-io', 'radio-io-at-d890uv-mm9pdy');
    expect(stock).toHaveLength(1);
    expect(mm9).toHaveLength(1);
    expect(stock[0]).toBe(mm9[0]);
    const record = encodeAtD890RxGroupRecord({
      index: 1,
      wireName: 'R',
      memberDigitalIds: [1000],
    });
    expect(readU32Le(record, 0)).toBe(1000);
    expect(talkgroupAddress(1000)).toBe(0x3a8_0000);
  });

  it('encodes wide-char name at 0x100', () => {
    const record = encodeAtD890RxGroupRecord({
      index: 1,
      wireName: 'Local',
      memberDigitalIds: [0],
    });
    expect(record[0x100]).toBe('L'.charCodeAt(0));
    expect(record[0x101]).toBe(0);
    expect(record[0x102]).toBe('o'.charCodeAt(0));
    expect(record[0x103]).toBe(0);
  });

  it('encodes up to RX_GROUP_MEMBERS_MAX members without truncating at 32', () => {
    const members = Array.from({ length: AT_D890UV_LIMITS.RX_GROUP_MEMBERS_MAX }, (_, i) => i);
    const record = encodeAtD890RxGroupRecord({
      index: 1,
      wireName: 'Full',
      memberDigitalIds: members,
    });
    expect(readU32Le(record, 31 * 4)).toBe(31);
    expect(readU32Le(record, 32 * 4)).toBe(32);
    expect(readU32Le(record, 63 * 4)).toBe(63);
  });
});

describe('encodeRxGroupsIntoAtD890Image', () => {
  it('sets occupancy bit for index 249 when encoding list 250', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    image.set(D890_MAP.ReceiveGroupSet, new Uint8Array(AT_D890_LIMITS.RX_GROUP_SET_BYTES));

    encodeRxGroupsIntoAtD890Image(image, [{ index: 250, wireName: 'High', memberDigitalIds: [0] }]);

    const outSet = image.get(D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES);
    expect(outSet[31]).toBe(0x02); // bit 249
  });

  it('clears phantom bits 250–255 when base image byte 31 is 0xff', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    image.set(
      D890_MAP.ReceiveGroupSet,
      new Uint8Array(AT_D890_LIMITS.RX_GROUP_SET_BYTES).fill(0xff),
    );

    encodeRxGroupsIntoAtD890Image(image, [{ index: 1, wireName: 'Local', memberDigitalIds: [0] }]);

    const outSet = image.get(D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES);
    expect(outSet[0]).toBe(0x01); // bit 0 from encoded list
    expect(outSet[31]).toBe(0x00); // not 0xfc from preserved bits 250–255
  });

  it('writes MM9PDY timeslot bytes at +0x120 and reads them back', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    image.set(D890_MAP.ReceiveGroupSet, new Uint8Array(AT_D890_LIMITS.RX_GROUP_SET_BYTES));
    encodeRxGroupsIntoAtD890Image(
      image,
      [
        {
          index: 1,
          wireName: 'Repeater',
          memberDigitalIds: [0, 1],
          memberTimeSlotOverrides: [undefined, 2],
        },
      ],
      { writeTimeSlotOverrides: true },
    );
    const stride = image.get(receiveGroupAddress(0), AT_D890_LIMITS.RX_GROUP_STRIDE);
    expect(stride[0x120]).toBe(0xff);
    expect(stride[0x121]).toBe(0x02);
    expect(decodeAtD890RxGroupTimeSlotOverrides(stride, 2)).toEqual([undefined, 2]);
  });

  it('fills a previous timeslot tail with 0xFF on the stock encode', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    image.set(D890_MAP.ReceiveGroupSet, new Uint8Array(AT_D890_LIMITS.RX_GROUP_SET_BYTES));
    const address = receiveGroupAddress(0);
    image.set(address + 0x120, new Uint8Array([0x01, 0x02]));
    encodeRxGroupsIntoAtD890Image(image, [
      { index: 1, wireName: 'Stock', memberDigitalIds: [0, 1], memberTimeSlotOverrides: [1, 2] },
    ]);
    const stride = image.get(address, AT_D890_LIMITS.RX_GROUP_STRIDE);
    expect(stride[0x120]).toBe(0xff);
    expect(stride[0x121]).toBe(0xff);
    expect(decodeAtD890RxGroupTimeSlotOverrides(stride, 2)).toEqual([undefined, undefined]);
  });
});

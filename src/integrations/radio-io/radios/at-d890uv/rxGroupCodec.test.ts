import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { encodeAtD890RxGroupRecord, encodeRxGroupsIntoAtD890Image } from './rxGroupCodec.ts';

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

    encodeRxGroupsIntoAtD890Image(image, [
      { index: 250, wireName: 'High', memberDigitalIds: [0] },
    ]);

    const outSet = image.get(D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES);
    expect(outSet[31]).toBe(0x02); // bit 249
  });

  it('leaves ReceiveGroupSet bytes for bits 250–255 when bit 255 was preset', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    const set = new Uint8Array(AT_D890_LIMITS.RX_GROUP_SET_BYTES);
    setBitmapBit(set, 255, true);
    image.set(D890_MAP.ReceiveGroupSet, set);

    encodeRxGroupsIntoAtD890Image(image, [
      { index: 1, wireName: 'Local', memberDigitalIds: [0] },
    ]);

    const outSet = image.get(D890_MAP.ReceiveGroupSet, AT_D890_LIMITS.RX_GROUP_SET_BYTES);
    expect(outSet[0]).toBe(0x01); // bit 0 from encoded list
    expect(outSet[31]).toBe(0x80); // bit 255 preserved
  });
});

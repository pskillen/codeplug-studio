import { describe, expect, it } from 'vitest';
import type { RadioNxdnRxGroupDto } from '../../radioWriteProjection.ts';
import { AT_D890_NXDN } from './constants.ts';
import type { AtD890NxdnStagedBytes } from './nxdnListCodec.ts';
import {
  decodeAtD890NxdnRxGroups,
  encodeAtD890NxdnRxGroupRecord,
  encodeAtD890NxdnRxGroups,
} from './nxdnRxGroupCodec.ts';

function readerFor(staged: AtD890NxdnStagedBytes[]) {
  return (address: number, length: number) => {
    const out = new Uint8Array(length).fill(0xff);
    for (const s of staged) {
      for (let i = 0; i < s.bytes.length; i++) {
        const offset = s.address + i - address;
        if (offset >= 0 && offset < length) out[offset] = s.bytes[i]!;
      }
    }
    return out;
  };
}

const LOCAL: RadioNxdnRxGroupDto = { wireName: 'Local', memberSlots: [0, 2, 5] };

describe('encodeAtD890NxdnRxGroupRecord', () => {
  it('writes members as contiguous u32 LE list slots, FFFFFFFF after the last, and the name at +0x100', () => {
    const record = encodeAtD890NxdnRxGroupRecord(LOCAL);
    expect(record.length).toBe(0x122);
    expect([...record.subarray(0, 12)]).toEqual([0, 0, 0, 0, 2, 0, 0, 0, 5, 0, 0, 0]);
    expect([...record.subarray(12, 16)]).toEqual([0xff, 0xff, 0xff, 0xff]);
    expect(record[0xfc]).toBe(0xff);
    expect([...record.subarray(0x100, 0x104)]).toEqual([0x4c, 0x00, 0x6f, 0x00]);
  });

  it('fills 64 members to the end of the member array', () => {
    const record = encodeAtD890NxdnRxGroupRecord({
      wireName: 'Full',
      memberSlots: Array.from({ length: 64 }, (_, i) => i),
    });
    expect(record[0xfc]).toBe(63);
    expect(record[0xff]).toBe(0);
  });

  it('refuses 65 members and a slot outside the list', () => {
    expect(() =>
      encodeAtD890NxdnRxGroupRecord({
        wireName: 'Big',
        memberSlots: Array.from({ length: 65 }, (_, i) => i),
      }),
    ).toThrow(/65 members/);
    expect(() => encodeAtD890NxdnRxGroupRecord({ wireName: 'Bad', memberSlots: [1000] })).toThrow(
      RangeError,
    );
    expect(() => encodeAtD890NxdnRxGroupRecord({ wireName: 'Bad', memberSlots: [-1] })).toThrow(
      RangeError,
    );
  });
});

describe('encodeAtD890NxdnRxGroups', () => {
  it('places list i at stride i and sets bit i in a positive bitmap', () => {
    const staged = encodeAtD890NxdnRxGroups([LOCAL, { wireName: 'Wide', memberSlots: [1] }]);
    expect(staged.map((s) => s.address)).toEqual([
      AT_D890_NXDN.RxGroupData,
      AT_D890_NXDN.RxGroupData + 0x200,
      AT_D890_NXDN.RxGroupSet,
    ]);
    const bitmap = staged[2]!.bytes;
    expect(bitmap.length).toBe(0x20);
    expect(bitmap[0]).toBe(0b11); // set = used
    expect(bitmap[1]).toBe(0);
  });

  it('stages an all-zero bitmap when there are no lists, so no list stays marked used', () => {
    const staged = encodeAtD890NxdnRxGroups([]);
    expect(staged).toHaveLength(1);
    expect(staged[0]!.address).toBe(AT_D890_NXDN.RxGroupSet);
    expect(staged[0]!.bytes.every((b) => b === 0)).toBe(true);
  });

  it('sets the last bit of a full 250-list unit and refuses 251', () => {
    const lists = Array.from({ length: 250 }, (_, i) => ({ wireName: `L${i}`, memberSlots: [] }));
    const staged = encodeAtD890NxdnRxGroups(lists);
    const bitmap = staged.at(-1)!.bytes;
    expect(bitmap[31]).toBe(0b0000_0011); // lists 248 and 249
    expect(staged.at(-2)!.address).toBe(AT_D890_NXDN.RxGroupData + 249 * 0x200);
    expect(() =>
      encodeAtD890NxdnRxGroups([...lists, { wireName: 'extra', memberSlots: [] }]),
    ).toThrow(/251/);
  });

  it('round-trips through decode', () => {
    const groups = [LOCAL, { wireName: 'Empty', memberSlots: [] }];
    expect(decodeAtD890NxdnRxGroups(readerFor(encodeAtD890NxdnRxGroups(groups)))).toEqual(groups);
  });
});

import { describe, expect, it } from 'vitest';
import type { RadioNxdnListEntryDto } from '../../radioWriteProjection.ts';
import { AT_D890_NXDN } from './constants.ts';
import {
  atD890NxdnOrderKey,
  decodeAtD890NxdnList,
  encodeAtD890NxdnList,
  encodeAtD890NxdnListOrder,
  encodeAtD890NxdnListRecord,
  isValidAtD890NxdnId,
  type AtD890NxdnStagedBytes,
} from './nxdnListCodec.ts';

const GROUP: RadioNxdnListEntryDto = { wireName: 'TG 1234', nxdnId: 1234, kind: 'group' };
const PERSON: RadioNxdnListEntryDto = {
  wireName: 'Alice',
  nxdnId: 5678,
  kind: 'individual',
  callsign: 'M0ABC',
  city: 'Leeds',
  state: 'Yorks',
  country: 'UK',
};

function find(staged: AtD890NxdnStagedBytes[], address: number): Uint8Array | undefined {
  return staged.find((s) => s.address === address)?.bytes;
}

/** A reader over staged bytes; everything else reads as erased flash. */
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

describe('encodeAtD890NxdnListRecord', () => {
  it('writes Attr 1 for a group, a 3-byte BCD ID at +2 and the name at +6', () => {
    const record = encodeAtD890NxdnListRecord(GROUP);
    expect(record.length).toBe(0xc8);
    expect(record[0]).toBe(1);
    expect([...record.subarray(2, 5)]).toEqual([0x00, 0x12, 0x34]);
    // 'T' 'G' as UTF-16LE.
    expect([...record.subarray(6, 10)]).toEqual([0x54, 0x00, 0x47, 0x00]);
    expect(record[5]).toBe(0); // TxForbid
    expect(record[1]).toBe(0); // Ring
  });

  it('writes Attr 0 for an individual and the contact text fields at the CPS offsets', () => {
    const record = encodeAtD890NxdnListRecord(PERSON);
    expect(record[0]).toBe(0);
    expect([...record.subarray(2, 5)]).toEqual([0x00, 0x56, 0x78]);
    expect(record[0x4c]).toBe('L'.charCodeAt(0)); // city
    expect(record[0x6c]).toBe('M'.charCodeAt(0)); // callsign
    expect(record[0x84]).toBe('Y'.charCodeAt(0)); // state
    expect(record[0xa6]).toBe('U'.charCodeAt(0)); // country
  });

  it('encodes 65519 as 06 55 19 and the all-call group 65535 as 06 55 35', () => {
    expect([
      ...encodeAtD890NxdnListRecord({ wireName: 'x', nxdnId: 65519, kind: 'individual' }).subarray(
        2,
        5,
      ),
    ]).toEqual([0x06, 0x55, 0x19]);
    expect([
      ...encodeAtD890NxdnListRecord({ wireName: 'All', nxdnId: 65535, kind: 'group' }).subarray(
        2,
        5,
      ),
    ]).toEqual([0x06, 0x55, 0x35]);
  });

  it('cuts the name at 16 characters', () => {
    const record = encodeAtD890NxdnListRecord({
      wireName: 'ABCDEFGHIJKLMNOPQRS',
      nxdnId: 1,
      kind: 'group',
    });
    expect(record[6 + 30]).toBe('P'.charCodeAt(0));
    expect(record[6 + 32]).toBe(0);
  });
});

describe('atD890NxdnOrderKey', () => {
  it('is the BCD hex integer times two, plus one for a group', () => {
    expect(atD890NxdnOrderKey(1234, 'group')).toBe(0x1234 * 2 + 1);
    expect(atD890NxdnOrderKey(5678, 'individual')).toBe(0x5678 * 2);
    expect(atD890NxdnOrderKey(65535, 'group')).toBe(0x065535 * 2 + 1);
  });
});

describe('encodeAtD890NxdnList', () => {
  it('stages the index, inverted set, records and order table for 1 group + 1 individual', () => {
    const staged = encodeAtD890NxdnList([GROUP, PERSON]);
    const index = find(staged, AT_D890_NXDN.ListIndex)!;
    expect(index.length).toBe(4000);
    expect([...index.subarray(0, 8)]).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
    expect([...index.subarray(8, 12)]).toEqual([0xff, 0xff, 0xff, 0xff]);

    const set = find(staged, AT_D890_NXDN.ListSet)!;
    expect(set.length).toBe(0x7e);
    expect(set[0]).toBe(0xfc); // bits 0 and 1 clear = used
    expect(set[1]).toBe(0xff);

    const records = find(staged, AT_D890_NXDN.ListData)!;
    expect(records.length).toBe(2 * 0xc8);
    expect(records[0]).toBe(1);
    expect(records[0xc8]).toBe(0);

    const order = find(staged, AT_D890_NXDN.ListOrder)!;
    expect(order.length).toBe(16);
    // Ascending by key: the group (key 0x2469, slot 0) sorts before the individual (0xACF0, slot 1).
    expect([...order]).toEqual([
      0x69, 0x24, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf0, 0xac, 0x00, 0x00, 0x01, 0x00, 0x00,
      0x00,
    ]);
  });

  it('sorts the order table by key whatever the slot order, with the slot as the value', () => {
    const order = encodeAtD890NxdnListOrder([PERSON, GROUP]);
    // Individual 5678 is slot 0, group 1234 is slot 1; the group's key is smaller.
    const view = new DataView(order.buffer);
    expect(view.getUint32(0, true)).toBe(0x2469);
    expect(view.getUint32(4, true)).toBe(1);
    expect(view.getUint32(8, true)).toBe(0xacf0);
    expect(view.getUint32(12, true)).toBe(0);
  });

  it('pads an odd order table to an even count with FF x 8', () => {
    const order = encodeAtD890NxdnListOrder([GROUP]);
    expect(order.length).toBe(16);
    expect([...order.subarray(8)]).toEqual(Array(8).fill(0xff));
  });

  it('keeps a group and an individual with the same ID apart, and drops a repeated key', () => {
    const same = encodeAtD890NxdnListOrder([
      { wireName: 'g', nxdnId: 99, kind: 'group' },
      { wireName: 'i', nxdnId: 99, kind: 'individual' },
    ]);
    expect(same.length).toBe(16);
    const dup = encodeAtD890NxdnListOrder([
      { wireName: 'a', nxdnId: 99, kind: 'group' },
      { wireName: 'b', nxdnId: 99, kind: 'group' },
    ]);
    // One unique key + one pad entry; the first slot wins.
    expect(new DataView(dup.buffer).getUint32(4, true)).toBe(0);
    expect([...dup.subarray(8)]).toEqual(Array(8).fill(0xff));
  });

  it('stages an empty list as an all-FF index and set with no records or order', () => {
    const staged = encodeAtD890NxdnList([]);
    expect(find(staged, AT_D890_NXDN.ListIndex)!.every((b) => b === 0xff)).toBe(true);
    expect(find(staged, AT_D890_NXDN.ListSet)!.every((b) => b === 0xff)).toBe(true);
    expect(find(staged, AT_D890_NXDN.ListData)).toBeUndefined();
    expect(find(staged, AT_D890_NXDN.ListOrder)).toBeUndefined();
  });

  it('fills the last bit of a full list', () => {
    const entries = Array.from({ length: 1000 }, (_, i): RadioNxdnListEntryDto => ({
      wireName: `n${i}`,
      nxdnId: i + 1,
      kind: 'individual',
    }));
    const staged = encodeAtD890NxdnList(entries);
    const set = find(staged, AT_D890_NXDN.ListSet)!;
    expect(set[124]).toBe(0x00); // bits 992-999 all clear
    expect(set[125]).toBe(0xff);
    expect(find(staged, AT_D890_NXDN.ListData)!.length).toBe(1000 * 0xc8);
    expect(find(staged, AT_D890_NXDN.ListOrder)!.length).toBe(8000);
  });

  it('refuses more than 1000 entries and IDs the radio does not accept', () => {
    const many = Array.from({ length: 1001 }, (_, i): RadioNxdnListEntryDto => ({
      wireName: 'n',
      nxdnId: (i % 60000) + 1,
      kind: 'group',
    }));
    expect(() => encodeAtD890NxdnList(many)).toThrow(/1001/);
    expect(() => encodeAtD890NxdnList([{ wireName: 'z', nxdnId: 0, kind: 'group' }])).toThrow(
      RangeError,
    );
    expect(() =>
      encodeAtD890NxdnList([{ wireName: 'z', nxdnId: 65535, kind: 'individual' }]),
    ).toThrow(RangeError);
    expect(() => encodeAtD890NxdnList([{ wireName: 'z', nxdnId: 65520, kind: 'group' }])).toThrow(
      RangeError,
    );
  });

  it('round-trips through decode', () => {
    const entries: RadioNxdnListEntryDto[] = [
      GROUP,
      { wireName: 'All call', nxdnId: 65535, kind: 'group' },
      PERSON,
    ];
    const decoded = decodeAtD890NxdnList(readerFor(encodeAtD890NxdnList(entries)));
    expect(decoded).toEqual([
      GROUP,
      { wireName: 'All call', nxdnId: 65535, kind: 'group' },
      { ...PERSON, callsign: 'M0ABC' },
    ]);
  });
});

describe('isValidAtD890NxdnId', () => {
  it('accepts 65535 for groups only and 1-65519 for both', () => {
    expect(isValidAtD890NxdnId(1, 'individual')).toBe(true);
    expect(isValidAtD890NxdnId(65519, 'individual')).toBe(true);
    expect(isValidAtD890NxdnId(65535, 'group')).toBe(true);
    expect(isValidAtD890NxdnId(65535, 'individual')).toBe(false);
    expect(isValidAtD890NxdnId(0, 'group')).toBe(false);
  });
});

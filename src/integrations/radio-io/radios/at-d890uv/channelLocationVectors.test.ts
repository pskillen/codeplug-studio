/**
 * Golden vectors from the firmware repo (pskillen/anytone-d890-firmware, channel distance
 * #75: `fw/tests/vectors/channel-distance-v1.json`, storage contract v1). The firmware is
 * checked against the same values in its emulator; copied here so Studio's writer is held
 * to the bytes the firmware reads. Synthetic records only.
 */
import { describe, expect, it } from 'vitest';
import {
  atD890ChannelNameCrc,
  decodeAtD890ChannelLocationTable,
  encodeAtD890ChannelLocationEntry,
  encodeAtD890ChannelLocationHeader,
} from './channelLocationCodec.ts';

const hex = (s: string) => Uint8Array.from(Buffer.from(s, 'hex'));
const toHex = (b: Uint8Array) => Buffer.from(b).toString('hex');

function recordWithName(nameFieldHex: string): Uint8Array {
  const record = new Uint8Array(0x80);
  record.set(hex(nameFieldHex), 0x44);
  return record;
}

const NAME_CRC = [
  ['ASCII', '47004200330050004100200050006100690073006c0065007900000000000000', 0x053f],
  ['16 characters', '520065006e00660072006500770073006800690072006500200044004d005200', 0xae02],
  ['empty', '0000000000000000000000000000000000000000000000000000000000000000', 0xffff],
  ['FFFF-terminated', '44004d00520020003100ffffffffffffffffffffffffffffffffffffffffffff', 0x649c],
  ['non-ASCII', '5a006f006e00650020002d4e8765000000000000000000000000000000000000', 0xcd0d],
] as const;

const MATCHING_RECORD =
  '004333440000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000047004200330050004100200050006100690073006c0065007900000000000000';

describe('AT-D890UV channel location v1 firmware vectors', () => {
  it.each(NAME_CRC)('name CRC: %s', (_label, field, crc) => {
    expect(atD890ChannelNameCrc(recordWithName(field))).toBe(crc);
  });

  it('encodes the valid headers byte for byte', () => {
    expect(toHex(encodeAtD890ChannelLocationHeader(3, 'km'))).toBe(
      '4c4f4331011003000000000000000000000000000000000000000000602a9396',
    );
    expect(toHex(encodeAtD890ChannelLocationHeader(4000, 'mi'))).toBe(
      '4c4f43310110a00f010000000000000000000000000000000000000044e0eb41',
    );
  });

  it('rejects the bad headers (CRC, factory test pattern, count over 4000)', () => {
    for (const bad of [
      '4c4f4331011003000000000000000000000000000000000000000000612a9396',
      '55555555555555555555ffffffffffffffffffffffffffffffffffffffffffff',
      '4c4f43310110a10f0000000000000000000000000000000000000000c2bfa433',
    ]) {
      expect(decodeAtD890ChannelLocationTable(hex(bad))).toBeNull();
    }
  });

  it('encodes the matching entry from its record and position', () => {
    const expected = hex('e88d5403283ebdff004333443f050148');
    const view = new DataView(expected.buffer);
    const location = { lat: view.getInt32(0, true) / 1e6, lon: view.getInt32(4, true) / 1e6 };
    expect(toHex(encodeAtD890ChannelLocationEntry(hex(MATCHING_RECORD), location))).toBe(
      'e88d5403283ebdff004333443f050148',
    );
  });

  it('decodes empty, no-flag and bad-check entries as no position', () => {
    const header = encodeAtD890ChannelLocationHeader(4, 'km');
    const table = new Uint8Array(0x20 + 4 * 16);
    table.set(header, 0);
    table.set(hex('e88d5403283ebdff004333443f050148'), 0x20);
    table.set(hex('00000000000000000000000000000000'), 0x30);
    table.set(hex('0000000000000000004333443f05005b'), 0x40);
    table.set(hex('e88d5403283ebdff004333443f0501b7'), 0x50);
    const decoded = decodeAtD890ChannelLocationTable(table)!;
    expect(decoded.entries[0]).not.toBeNull();
    expect(decoded.entries.slice(1)).toEqual([null, null, null]);
  });
});

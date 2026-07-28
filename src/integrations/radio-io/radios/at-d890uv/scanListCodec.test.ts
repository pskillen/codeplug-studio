import { describe, expect, it } from 'vitest';
import { encodeAtD890ScanListRecord } from './scanListCodec.ts';

function readU16Le(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

const PRIORITY_OFF = 0xffff;

describe('scanListCodec', () => {
  it('encodes scan members as 0-based channel indices', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Scan',
      listIndex: 1,
      channelNumbers: [1, 3],
    });
    expect(readU16Le(record, 0x30)).toBe(0);
    expect(readU16Le(record, 0x32)).toBe(2);
    expect(readU16Le(record, 0x34)).toBe(0xffff);
  });

  it('encodes designated TX as 0-based channel index; priority 2 stays Off', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Scan',
      listIndex: 1,
      channelNumbers: [2, 4],
      designatedTxChannel: 5,
    });
    expect(readU16Le(record, 0x2)).toBe(4);
    expect(readU16Le(record, 0x4)).toBe(PRIORITY_OFF);
  });

  it('leaves priority fields Off when no designated TX is set', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Empty',
      listIndex: 1,
      channelNumbers: [],
    });
    expect(readU16Le(record, 0x2)).toBe(PRIORITY_OFF);
    expect(readU16Le(record, 0x4)).toBe(PRIORITY_OFF);
  });

  it('fills trailing record bytes after revert with 0xff (not channel index 0)', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Home Shack',
      listIndex: 1,
      channelNumbers: [53, 54, 55],
    });
    expect(record[0x94]).toBe(0);
    for (let off = 0x95; off < 0xd0; off++) {
      expect(record[off]).toBe(0xff);
    }
    for (let slot = 3; slot < 50; slot++) {
      expect(readU16Le(record, 0x30 + slot * 2)).toBe(0xffff);
    }
  });
});

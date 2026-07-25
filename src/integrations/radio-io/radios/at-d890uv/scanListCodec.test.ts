import { describe, expect, it } from 'vitest';
import { encodeAtD890ScanListRecord } from './scanListCodec.ts';

function readU16Le(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

describe('scanListCodec', () => {
  it('encodes scan members as 0-based channel indices', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Scan',
      listIndex: 1,
      channelNumbers: [1, 3],
    });
    expect(readU16Le(record, 0x30)).toBe(0);
    expect(readU16Le(record, 0x32)).toBe(2);
    expect(record[0x34]).toBe(0xff);
  });

  it('encodes designated TX and priority-2 as 0-based channel indices', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Scan',
      listIndex: 1,
      channelNumbers: [2, 4],
      designatedTxChannel: 5,
    });
    expect(readU16Le(record, 0x2)).toBe(4);
    expect(readU16Le(record, 0x4)).toBe(3);
  });

  it('leaves priority fields as 0 when no channel is set', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Empty',
      listIndex: 1,
      channelNumbers: [],
    });
    expect(readU16Le(record, 0x2)).toBe(0);
    expect(readU16Le(record, 0x4)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { encodeAtD890RxGroupRecord } from './rxGroupCodec.ts';

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
});

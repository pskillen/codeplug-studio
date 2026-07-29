import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { AT_D890_SCAN_TIMING_DECISECONDS } from '@core/radios/anytone/at-d890uv/scanListWireDefaults.ts';
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

  it('keeps priority channels Off regardless of designated TX', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Scan',
      listIndex: 1,
      channelNumbers: [2, 4],
      designatedTxChannel: 5,
    });
    expect(readU16Le(record, 0x2)).toBe(PRIORITY_OFF);
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

  it('pins timing fields to 3.0 s (deciseconds)', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Scan',
      listIndex: 1,
      channelNumbers: [1],
    });
    expect(readU16Le(record, 0x6)).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
    expect(readU16Le(record, 0x8)).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
    expect(readU16Le(record, 0xa)).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
    expect(readU16Le(record, 0xc)).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
  });

  it('writes revert channel at 0xF8 and does not use member slot 50 as revert', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Home Shack',
      listIndex: 1,
      channelNumbers: [53, 54, 55],
    });
    expect(record[0xf8]).toBe(0x01);
    expect(record[0xf9]).toBe(0);
    expect(readU16Le(record, 0x94)).toBe(0xffff);
    for (let slot = 3; slot < AT_D890UV_LIMITS.SCAN_LIST_MEMBERS_MAX; slot++) {
      expect(readU16Le(record, 0x30 + slot * 2)).toBe(0xffff);
    }
  });
});

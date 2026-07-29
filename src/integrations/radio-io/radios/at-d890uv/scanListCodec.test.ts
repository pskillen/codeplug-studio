import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { AT_D890_SCAN_TIMING_DECISECONDS } from '@core/radios/anytone/at-d890uv/scanListWireDefaults.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import {
  encodeAtD890ScanListRecord,
  encodeScanListsIntoAtD890Image,
  refreshScanListSetFromRadioBase,
} from './scanListCodec.ts';

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

describe('encodeScanListsIntoAtD890Image', () => {
  it('leaves ScanListSet bytes for bits 100–255 when bit 249 was preset', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    const set = new Uint8Array(AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
    setBitmapBit(set, 249, true);
    image.set(D890_MAP.ScanListSet, set);

    encodeScanListsIntoAtD890Image(image, [
      { wireName: 'Home', listIndex: 1, channelNumbers: [1] },
    ]);

    const outSet = image.get(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
    expect(outSet[0]).toBe(0x01); // bit 0 from encoded list
    expect(outSet[31]).toBe(0x02); // bit 249 preserved
  });

  it('refreshScanListSetFromRadioBase preserves bits 100+ from live radio not stale cache', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    image.set(D890_MAP.ScanListSet, new Uint8Array(AT_D890_LIMITS.SCAN_LIST_SET_BYTES));

    encodeScanListsIntoAtD890Image(image, [
      { wireName: 'Home', listIndex: 1, channelNumbers: [1] },
    ]);
    expect(image.get(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES)[31]).toBe(0x00);

    const freshRadio = new Uint8Array(AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
    setBitmapBit(freshRadio, 249, true);
    refreshScanListSetFromRadioBase(image, freshRadio);

    const outSet = image.get(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
    expect(outSet[0]).toBe(0x01);
    expect(outSet[31]).toBe(0x02);
  });
});

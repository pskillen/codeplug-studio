import { describe, expect, it } from 'vitest';
import { AT_D890UV_LIMITS } from '@core/radios/anytone/at-d890uv/limits.ts';
import { AT_D890_SCAN_TIMING_DECISECONDS } from '@core/radios/anytone/at-d890uv/scanListWireDefaults.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { setBitmapBit } from './bitmap.ts';
import { AT_D890_LIMITS, D890_MAP } from './constants.ts';
import { scanListAddress } from './memory.ts';
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

  it('pins timing fields to 3.0 s (deciseconds) when unset', () => {
    const record = encodeAtD890ScanListRecord({
      wireName: 'Scan',
      listIndex: 1,
      channelNumbers: [1],
    });
    expect(record[0x6]).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
    expect(record[0x8]).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
    expect(record[0xa]).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
    expect(record[0xc]).toBe(AT_D890_SCAN_TIMING_DECISECONDS);
  });

  it('writes custom timing deciseconds when provided', () => {
    const record = encodeAtD890ScanListRecord(
      {
        wireName: 'Scan',
        listIndex: 1,
        channelNumbers: [1],
      },
      {
        lookBackA: 25,
        lookBackB: 40,
        dropoutDelay: 15,
        dwellTime: 31,
      },
    );
    expect(record[0x6]).toBe(25);
    expect(record[0x8]).toBe(40);
    expect(record[0xa]).toBe(15);
    expect(record[0xc]).toBe(31);
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
  it('stores listIndex 33 in bank 1 and leaves the gap after bank 0 erased', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    encodeScanListsIntoAtD890Image(image, [
      { wireName: 'Far', listIndex: 33, channelNumbers: [1] },
    ]);

    expect(scanListAddress(32)).toBe(0x218_0000);
    const stored = image.get(scanListAddress(32), AT_D890_LIMITS.SCAN_LIST_RECORD_SIZE);
    expect(stored[0xf8]).toBe(0x01);
    // Byte 0 is unmodelled and stays the erased prior, not the record's zero fill.
    expect(stored[0]).toBe(0xff);
    // Flat `base + 32 * stride` is the first byte after bank 0, not list 32.
    expect(image.get(0x210_4000, 1)[0]).toBe(0xff);
    expect(image.get(0x210_4000 + 0xf8, 1)[0]).toBe(0xff);
  });

  it('keeps unmodelled bytes from the downloaded record and still writes one-byte timings', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    const prior = new Uint8Array(AT_D890_LIMITS.SCAN_LIST_STRIDE);
    prior[0x00] = 0x11;
    prior[0x01] = 0xab;
    prior[0x07] = 0x22;
    prior[0x09] = 0x33;
    prior[0x0b] = 0x44;
    prior[0x0d] = 0x55;
    prior[0xf8] = 0x66;
    prior[0xf9] = 0x77;
    prior[0xfa] = 0x88;
    prior[0xfb] = 0x99;
    image.set(scanListAddress(0), prior);
    const neighbour = scanListAddress(1);
    image.set(neighbour, Uint8Array.of(0x42));

    encodeScanListsIntoAtD890Image(
      image,
      [{ wireName: 'Scan', listIndex: 1, channelNumbers: [1] }],
      { lookBackA: 25, lookBackB: 40, dropoutDelay: 15, dwellTime: 31 },
    );

    const out = image.get(scanListAddress(0), AT_D890_LIMITS.SCAN_LIST_STRIDE);
    expect(out[0x06]).toBe(25);
    expect(out[0x08]).toBe(40);
    expect(out[0x0a]).toBe(15);
    expect(out[0x0c]).toBe(31);
    expect(out[0x00]).toBe(0x11);
    expect(out[0x07]).toBe(0x22);
    expect(out[0x09]).toBe(0x33);
    expect(out[0x0b]).toBe(0x44);
    expect(out[0x0d]).toBe(0x55);
    expect(out[0xf8]).toBe(0x01);
    expect(out[0xf9]).toBe(0x77);
    expect(out[0xfa]).toBe(0x88);
    expect(out[0xfb]).toBe(0x99);
    expect(out[0x01]).toBe(0x00);
    expect(image.get(neighbour, 1)[0]).toBe(0xff);
  });

  it('clears modelled scan-list bits through 249 and preserves a bit in 250–255', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    const set = new Uint8Array(AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
    setBitmapBit(set, 249, true);
    setBitmapBit(set, 255, true);
    image.set(D890_MAP.ScanListSet, set);

    encodeScanListsIntoAtD890Image(image, [
      { wireName: 'Home', listIndex: 1, channelNumbers: [1] },
    ]);

    const outSet = image.get(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
    expect(outSet[0]).toBe(0x01); // bit 0 from encoded list
    expect(outSet[31]! & 0x02).toBe(0); // bit 249 cleared with the modelled range
    expect(outSet[31]! & 0x80).toBe(0x80); // bit 255 preserved
  });

  it('refreshScanListSetFromRadioBase preserves bits 250+ from live radio not stale cache', () => {
    const image = createMemoryMap(0x500_0000);
    image.fill(0, 0x500_0000, 0xff);
    image.set(D890_MAP.ScanListSet, new Uint8Array(AT_D890_LIMITS.SCAN_LIST_SET_BYTES));

    encodeScanListsIntoAtD890Image(image, [
      { wireName: 'Home', listIndex: 1, channelNumbers: [1] },
    ]);
    expect(image.get(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES)[31]).toBe(0x00);

    const freshRadio = new Uint8Array(AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
    setBitmapBit(freshRadio, 249, true);
    setBitmapBit(freshRadio, 255, true);
    refreshScanListSetFromRadioBase(image, freshRadio);

    const outSet = image.get(D890_MAP.ScanListSet, AT_D890_LIMITS.SCAN_LIST_SET_BYTES);
    expect(outSet[0]).toBe(0x01);
    expect(outSet[31]! & 0x02).toBe(0); // bit 249 cleared
    expect(outSet[31]! & 0x80).toBe(0x80); // bit 255 preserved
  });
});

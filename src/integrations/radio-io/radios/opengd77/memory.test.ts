import { describe, expect, it } from 'vitest';
import { OPENGD77_SECTOR, OPENUV380_FLASH_SPANS, OPENUV380_IMAGE_SIZE } from './constants.ts';
import {
  collectDirtySectors,
  createOpenUv380Image,
  openUv380DownloadByteCount,
  writeAbs,
} from './memory.ts';

describe('opengd77 memory', () => {
  it('creates full-size 0xff image', () => {
    const image = createOpenUv380Image();
    expect(image.size).toBe(OPENUV380_IMAGE_SIZE);
    expect(image.bytes[0]).toBe(0xff);
  });

  it('download byte count matches registered spans', () => {
    const expected = OPENUV380_FLASH_SPANS.reduce((s, span) => s + span.length, 0);
    expect(openUv380DownloadByteCount()).toBe(expected);
  });

  it('collects dirty sectors only for changed registered bytes', () => {
    const prior = createOpenUv380Image();
    const next = createOpenUv380Image();
    // settings region @ 0x80
    writeAbs(next, 0x80, new Uint8Array([0x01, 0x02, 0x03]));
    const dirty = collectDirtySectors(prior, next);
    expect(dirty.length).toBe(1);
    expect(dirty[0]!.sectorAbs).toBe(0);
    expect(dirty[0]!.payload.length).toBe(OPENGD77_SECTOR);
    expect(dirty[0]!.payload[0x80]).toBe(0x01);
  });
});

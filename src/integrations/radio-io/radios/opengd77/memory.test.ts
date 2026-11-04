import { describe, expect, it } from 'vitest';
import {
  OPENGD77_BLOCK,
  OPENGD77_SECTOR,
  OPENUV380_FLASH_SPANS,
  OPENUV380_IMAGE_SIZE,
} from './constants.ts';
import {
  assertSpansBlockAligned,
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

  it('registered span edges are 32-byte aligned', () => {
    expect(() => assertSpansBlockAligned()).not.toThrow();
    for (const span of OPENUV380_FLASH_SPANS) {
      expect(span.start % OPENGD77_BLOCK).toBe(0);
      expect(span.length % OPENGD77_BLOCK).toBe(0);
    }
    expect(() => assertSpansBlockAligned([{ start: 0xa0, length: 0x40 }])).not.toThrow();
    expect(() => assertSpansBlockAligned([{ start: 0x81, length: 0x20 }])).toThrow(RangeError);
    expect(() => assertSpansBlockAligned([{ start: 0x80, length: 0x21 }])).toThrow(RangeError);
  });

  it('sector 0x6000 blocks stop at the span edge, leaving 0x6060.. (radio settings) alone', () => {
    const prior = createOpenUv380Image();
    const next = createOpenUv380Image();
    writeAbs(next, 0x6000, new Uint8Array([0x11]));
    const [sector] = collectDirtySectors(prior, next);
    expect(sector!.sectorAbs).toBe(0x6000);
    expect(sector!.blocks[0]).toBe(0);
    expect(sector!.blocks[sector!.blocks.length - 1]).toBe(0x40);
    expect(sector!.blocks.length).toBe(0x60 / OPENGD77_BLOCK);
  });

  it('sector 0x7000 blocks start at the span start 0x7500', () => {
    const prior = createOpenUv380Image();
    const next = createOpenUv380Image();
    writeAbs(next, 0x7500, new Uint8Array([0x22]));
    const [sector] = collectDirtySectors(prior, next);
    expect(sector!.sectorAbs).toBe(0x7000);
    expect(sector!.blocks[0]).toBe(0x500);
    expect(sector!.blocks.length).toBe((OPENGD77_SECTOR - 0x500) / OPENGD77_BLOCK);
  });

  it('sector 0x0000 blocks start at 0x80', () => {
    const prior = createOpenUv380Image();
    const next = createOpenUv380Image();
    writeAbs(next, 0x80, new Uint8Array([0x33]));
    const [sector] = collectDirtySectors(prior, next);
    expect(sector!.blocks[0]).toBe(0x80);
  });
});

import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';
import {
  encodeDm32Zone,
  encodeZonesIntoDm32Image,
  DM32_ZONE_ENTRY_SIZE,
  DM32_ZONE_START_OFFSET,
} from './zoneCodec.ts';
import {
  encodeDm32ScanList,
  encodeScanListsIntoDm32Image,
  dm32ScanListEntryOffset,
} from './scanListCodec.ts';

function makeBlock(metadata: number): Uint8Array {
  const b = new Uint8Array(DM32_BLOCK_SIZE);
  b.fill(0xff);
  b[DM32_METADATA_OFFSET] = metadata;
  return b;
}

describe('encodeDm32Zone', () => {
  it('packs name, count, and u16 LE members without 0x0000 terminator', () => {
    const rec = encodeDm32Zone({ wireName: 'Local', channelNumbers: [1, 2, 40] });
    expect(rec.length).toBe(DM32_ZONE_ENTRY_SIZE);
    expect(rec[0]).toBe('L'.charCodeAt(0));
    expect(rec[16]).toBe(3);
    expect(rec[17] | (rec[18]! << 8)).toBe(1);
    expect(rec[19] | (rec[20]! << 8)).toBe(2);
    expect(rec[21] | (rec[22]! << 8)).toBe(40);
    // pad after members stays 0xFF
    expect(rec[23]).toBe(0xff);
  });
});

describe('encodeZonesIntoDm32Image', () => {
  it('writes zones into first 0x5c block at offset 16', () => {
    const zoneData = makeBlock(DM32_METADATA.ZONE);
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.set(0, zoneData);
    encodeZonesIntoDm32Image(
      image,
      { addressBase: 0, discovered: [{ address: 0, metadata: DM32_METADATA.ZONE }] },
      [{ wireName: 'A', channelNumbers: [5] }],
    );
    expect(image.bytes[0]).toBe(1);
    const nameOff = DM32_ZONE_START_OFFSET;
    expect(image.bytes[nameOff]).toBe('A'.charCodeAt(0));
    expect(image.bytes[nameOff + 16]).toBe(1);
    expect(image.bytes[nameOff + 17] | (image.bytes[nameOff + 18]! << 8)).toBe(5);
    expect(image.bytes[DM32_METADATA_OFFSET]).toBe(DM32_METADATA.ZONE);
  });
});

describe('encodeDm32ScanList', () => {
  it('packs members and current-TX default', () => {
    const rec = encodeDm32ScanList({
      wireName: 'Scan1',
      channelNumbers: [3, 4],
      listIndex: 1,
    });
    expect(rec[0x0b]).toBe(2);
    expect((rec[0x0c]! >> 2) & 0x03).toBe(1); // current
    expect(rec[0x1a] | (rec[0x1b]! << 8)).toBe(3);
    expect(rec[0x1c] | (rec[0x1d]! << 8)).toBe(4);
  });
});

describe('encodeScanListsIntoDm32Image', () => {
  it('writes count and entry at (57*N)-56', () => {
    const scanData = makeBlock(DM32_METADATA.SCAN_LIST);
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.set(0, scanData);
    encodeScanListsIntoDm32Image(
      image,
      { addressBase: 0, discovered: [{ address: 0, metadata: DM32_METADATA.SCAN_LIST }] },
      [{ wireName: 'S1', channelNumbers: [1], listIndex: 1 }],
    );
    expect(image.bytes[0]).toBe(1);
    const off = dm32ScanListEntryOffset(1);
    expect(image.bytes[off]).toBe('S'.charCodeAt(0));
    expect(image.bytes[DM32_METADATA_OFFSET]).toBe(DM32_METADATA.SCAN_LIST);
  });
});

import { describe, expect, it } from 'vitest';
import { DM32UV_LIMITS } from '@core/radios/baofeng/dm-32uv/limits.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';
import {
  encodeDm32Zone,
  encodeZonesIntoDm32Image,
  DM32_ZONE_ENTRY_SIZE,
  DM32_ZONE_START_OFFSET,
  DM32_ZONE_HEADER_CHANNEL_INDEX_A,
  DM32_ZONE_HEADER_CHANNEL_INDEX_B,
  DM32_ZONE_HEADER_ZONE_INDEX_A,
  DM32_ZONE_HEADER_ZONE_INDEX_B,
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
    expect(rec[5]).toBe(0);
    expect(rec[6]).toBe(0xff);
    expect(rec[15]).toBe(0xff);
    expect(rec[16]).toBe(3);
    expect(rec[17] | (rec[18]! << 8)).toBe(1);
    expect(rec[19] | (rec[20]! << 8)).toBe(2);
    expect(rec[21] | (rec[22]! << 8)).toBe(40);
    // pad after members stays 0xFF
    expect(rec[23]).toBe(0xff);
  });

  it('writes a 16-character name through byte 15 and keeps the member count at byte 16', () => {
    const name = 'ABCDEFGHIJKLMNOP';
    const rec = encodeDm32Zone({ wireName: name, channelNumbers: [7, 9] });
    expect(name.length).toBe(DM32UV_LIMITS.NAME_LENGTH_CHANNEL_ZONE_CONTACT_TG);
    for (let i = 0; i < name.length; i++) {
      expect(rec[i]).toBe(name.charCodeAt(i));
    }
    expect(rec[15]).toBe('P'.charCodeAt(0));
    expect(rec[16]).toBe(2);
    expect(rec[17] | (rec[18]! << 8)).toBe(7);
    expect(rec[19] | (rec[20]! << 8)).toBe(9);
  });
});

describe('encodeZonesIntoDm32Image', () => {
  it('clears prior zone when list shrinks', () => {
    const zoneData = makeBlock(DM32_METADATA.ZONE);
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.set(0, zoneData);
    const ctx = { addressBase: 0, discovered: [{ address: 0, metadata: DM32_METADATA.ZONE }] };

    encodeZonesIntoDm32Image(image, ctx, [
      { wireName: 'First', channelNumbers: [1, 2] },
      { wireName: 'Second', channelNumbers: [3] },
    ]);
    const secondZoneOff = DM32_ZONE_START_OFFSET + DM32_ZONE_ENTRY_SIZE;
    expect(image.bytes[secondZoneOff]).toBe('S'.charCodeAt(0));

    encodeZonesIntoDm32Image(image, ctx, [{ wireName: 'Only', channelNumbers: [5] }]);
    expect(image.bytes[DM32_ZONE_START_OFFSET]).toBe('O'.charCodeAt(0));
    expect(image.bytes[secondZoneOff]).not.toBe('S'.charCodeAt(0));
    expect(image.bytes[secondZoneOff]).toBe(0x00);
    expect(image.bytes[secondZoneOff + 16]).toBe(0x00);
  });

  it('clears trailing zone slots so byte 16 is not mistaken for count=255', () => {
    const zoneData = makeBlock(DM32_METADATA.ZONE);
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.set(0, zoneData);
    const zones = Array.from({ length: 13 }, (_, i) => ({
      wireName: `Z${i + 1}`,
      channelNumbers: [i + 1],
    }));
    encodeZonesIntoDm32Image(
      image,
      { addressBase: 0, discovered: [{ address: 0, metadata: DM32_METADATA.ZONE }] },
      zones,
    );
    expect(image.bytes[0]).toBe(13);
    const trailingOff = DM32_ZONE_START_OFFSET + 13 * DM32_ZONE_ENTRY_SIZE;
    expect(image.bytes[trailingOff + 16]).toBe(0x00);
    expect(image.bytes[trailingOff]).toBe(0x00);
  });

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

  it('clamps stale VFO A/B zone and channel indices when projection shrinks', () => {
    const zoneData = makeBlock(DM32_METADATA.ZONE);
    zoneData[DM32_ZONE_HEADER_CHANNEL_INDEX_A] = 47;
    zoneData[DM32_ZONE_HEADER_CHANNEL_INDEX_B] = 40;
    zoneData[DM32_ZONE_HEADER_ZONE_INDEX_A] = 12;
    zoneData[DM32_ZONE_HEADER_ZONE_INDEX_B] = 8;
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.set(0, zoneData);
    encodeZonesIntoDm32Image(
      image,
      { addressBase: 0, discovered: [{ address: 0, metadata: DM32_METADATA.ZONE }] },
      [{ wireName: 'Only', channelNumbers: [3] }],
      { channelCount: 5 },
    );
    expect(image.bytes[DM32_ZONE_HEADER_CHANNEL_INDEX_A]).toBe(1);
    expect(image.bytes[DM32_ZONE_HEADER_CHANNEL_INDEX_B]).toBe(1);
    expect(image.bytes[DM32_ZONE_HEADER_ZONE_INDEX_A]).toBe(1);
    expect(image.bytes[DM32_ZONE_HEADER_ZONE_INDEX_B]).toBe(1);
  });

  it('preserves in-range VFO indices and leaves unset at 0', () => {
    const zoneData = makeBlock(DM32_METADATA.ZONE);
    zoneData[DM32_ZONE_HEADER_CHANNEL_INDEX_A] = 3;
    zoneData[DM32_ZONE_HEADER_CHANNEL_INDEX_B] = 0;
    zoneData[DM32_ZONE_HEADER_ZONE_INDEX_A] = 2;
    zoneData[DM32_ZONE_HEADER_ZONE_INDEX_B] = 0;
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.set(0, zoneData);
    encodeZonesIntoDm32Image(
      image,
      { addressBase: 0, discovered: [{ address: 0, metadata: DM32_METADATA.ZONE }] },
      [
        { wireName: 'Z1', channelNumbers: [1] },
        { wireName: 'Z2', channelNumbers: [2] },
      ],
      { channelCount: 10 },
    );
    expect(image.bytes[DM32_ZONE_HEADER_CHANNEL_INDEX_A]).toBe(3);
    expect(image.bytes[DM32_ZONE_HEADER_CHANNEL_INDEX_B]).toBe(0);
    expect(image.bytes[DM32_ZONE_HEADER_ZONE_INDEX_A]).toBe(2);
    expect(image.bytes[DM32_ZONE_HEADER_ZONE_INDEX_B]).toBe(0);
  });

  function zones(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      wireName: `Z${i + 1}`,
      channelNumbers: [i + 1],
    }));
  }

  function imageFromDiscovered(blocks: { address: number; metadata: number; marker?: number }[]) {
    const base = Math.min(...blocks.map((b) => b.address));
    const last = Math.max(...blocks.map((b) => b.address));
    const image = createMemoryMap(last - base + DM32_BLOCK_SIZE);
    image.fill(0, image.size, 0xff);
    for (const block of blocks) {
      const data = makeBlock(block.metadata);
      if (block.marker != null) data[0] = block.marker;
      image.set(block.address - base, data);
    }
    return {
      image,
      addressBase: base,
      discovered: blocks.map(({ address, metadata }) => ({ address, metadata })),
    };
  }

  it('keeps the header on 0x5C when 0x5D has the lower address', () => {
    const headerAddr = 0x2000;
    const laterAddr = 0x1000;
    const packed = imageFromDiscovered([
      {
        address: headerAddr,
        metadata: DM32_METADATA.ZONE,
        marker: 0x11,
      },
      { address: laterAddr, metadata: 0x5d, marker: 0x22 },
    ]);
    packed.image.bytes[headerAddr - packed.addressBase + DM32_ZONE_HEADER_CHANNEL_INDEX_A] = 3;

    const claimed: number[] = [];
    encodeZonesIntoDm32Image(packed.image, packed, zones(29), {
      channelCount: 10,
      claimedAddresses: claimed,
    });

    const headerOff = headerAddr - packed.addressBase;
    const laterOff = laterAddr - packed.addressBase;
    expect(packed.image.bytes[headerOff + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.ZONE);
    expect(packed.image.bytes[laterOff + DM32_METADATA_OFFSET]).toBe(0x5d);
    expect(packed.image.bytes[headerOff]).toBe(28);
    expect(packed.image.bytes[headerOff + DM32_ZONE_HEADER_CHANNEL_INDEX_A]).toBe(3);
    expect(packed.image.bytes[headerOff + DM32_ZONE_START_OFFSET]).toBe('Z'.charCodeAt(0));
    expect(packed.image.bytes[headerOff + DM32_ZONE_START_OFFSET + 1]).toBe('1'.charCodeAt(0));
    const zone29 = laterOff;
    expect(packed.image.bytes[zone29]).toBe('Z'.charCodeAt(0));
    expect(packed.image.bytes[zone29 + 1]).toBe('2'.charCodeAt(0));
    expect(packed.image.bytes[zone29 + 2]).toBe('9'.charCodeAt(0));
    expect(claimed).toEqual([]);
  });

  it('claims the lower free page as 0x5D and leaves other tags unchanged', () => {
    const zoneAddr = 0x1000;
    const calibrationAddr = 0x2000;
    const settingsAddr = 0x3000;
    const higherFree = 0x5000;
    const lowerFree = 0x4000;
    const packed = imageFromDiscovered([
      { address: zoneAddr, metadata: DM32_METADATA.ZONE },
      { address: calibrationAddr, metadata: DM32_METADATA.CALIBRATION, marker: 0x22 },
      { address: settingsAddr, metadata: DM32_METADATA.VFO_SETTINGS, marker: 0x44 },
      { address: higherFree, metadata: DM32_METADATA.EMPTY, marker: 0x11 },
      { address: lowerFree, metadata: DM32_METADATA.EMPTY_ALT, marker: 0x33 },
    ]);
    const claimed: number[] = [];
    encodeZonesIntoDm32Image(packed.image, packed, zones(29), { claimedAddresses: claimed });

    const at = (address: number) => address - packed.addressBase;
    expect(claimed).toEqual([lowerFree]);
    expect(packed.image.bytes[at(lowerFree) + DM32_METADATA_OFFSET]).toBe(0x5d);
    expect(packed.image.bytes[at(lowerFree)]).toBe('Z'.charCodeAt(0));
    expect(packed.image.bytes[at(lowerFree) + 1]).toBe('2'.charCodeAt(0));
    expect(packed.image.bytes[at(lowerFree) + 2]).toBe('9'.charCodeAt(0));
    expect(packed.image.bytes[at(zoneAddr) + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.ZONE);
    expect(packed.image.bytes[at(calibrationAddr)]).toBe(0x22);
    expect(packed.image.bytes[at(calibrationAddr) + DM32_METADATA_OFFSET]).toBe(
      DM32_METADATA.CALIBRATION,
    );
    expect(packed.image.bytes[at(settingsAddr)]).toBe(0x44);
    expect(packed.image.bytes[at(settingsAddr) + DM32_METADATA_OFFSET]).toBe(
      DM32_METADATA.VFO_SETTINGS,
    );
    expect(packed.image.bytes[at(higherFree)]).toBe(0x11);
    expect(packed.image.bytes[at(higherFree) + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.EMPTY);
  });

  it('omits leftover zones when the only other block is calibration', () => {
    const zoneAddr = 0x1000;
    const calibrationAddr = 0x2000;
    const packed = imageFromDiscovered([
      { address: zoneAddr, metadata: DM32_METADATA.ZONE },
      { address: calibrationAddr, metadata: DM32_METADATA.CALIBRATION, marker: 0x22 },
    ]);
    const claimed: number[] = [];
    encodeZonesIntoDm32Image(packed.image, packed, zones(29), { claimedAddresses: claimed });

    const headerOff = zoneAddr - packed.addressBase;
    const calibrationOff = calibrationAddr - packed.addressBase;
    expect(claimed).toEqual([]);
    expect(packed.image.bytes[headerOff]).toBe(28);
    expect(packed.image.bytes[headerOff + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.ZONE);
    expect(packed.image.bytes[calibrationOff]).toBe(0x22);
    expect(packed.image.bytes[calibrationOff + DM32_METADATA_OFFSET]).toBe(
      DM32_METADATA.CALIBRATION,
    );
    const lastOnHeader = headerOff + DM32_ZONE_START_OFFSET + 27 * DM32_ZONE_ENTRY_SIZE;
    expect(packed.image.bytes[lastOnHeader]).toBe('Z'.charCodeAt(0));
    expect(packed.image.bytes[lastOnHeader + 1]).toBe('2'.charCodeAt(0));
    expect(packed.image.bytes[lastOnHeader + 2]).toBe('8'.charCodeAt(0));
  });

  it('does not claim a page for an empty zone list', () => {
    const packed = imageFromDiscovered([
      { address: 0x1000, metadata: DM32_METADATA.ZONE },
      { address: 0x2000, metadata: DM32_METADATA.EMPTY, marker: 0x11 },
    ]);
    const claimed: number[] = [];
    encodeZonesIntoDm32Image(packed.image, packed, [], { claimedAddresses: claimed });
    expect(claimed).toEqual([]);
    expect(packed.image.bytes[DM32_BLOCK_SIZE]).toBe(0x11);
    expect(packed.image.bytes[DM32_BLOCK_SIZE + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.EMPTY);
    expect(packed.image.bytes[DM32_METADATA_OFFSET]).toBe(DM32_METADATA.ZONE);
  });

  it('does not stamp a duplicate zone tag', () => {
    const lower = 0x1000;
    const higher = 0x2000;
    const packed = imageFromDiscovered([
      { address: higher, metadata: DM32_METADATA.ZONE, marker: 0x5a },
      { address: lower, metadata: DM32_METADATA.ZONE, marker: 0x11 },
    ]);
    encodeZonesIntoDm32Image(packed.image, packed, zones(1));
    expect(packed.image.bytes[DM32_ZONE_START_OFFSET]).toBe('Z'.charCodeAt(0));
    expect(packed.image.bytes[DM32_METADATA_OFFSET]).toBe(DM32_METADATA.ZONE);
    expect(packed.image.bytes[DM32_BLOCK_SIZE]).toBe(0x5a);
    expect(packed.image.bytes[DM32_BLOCK_SIZE + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.ZONE);
  });
});

describe('encodeDm32ScanList', () => {
  it('packs members and current-TX default', () => {
    const rec = encodeDm32ScanList({
      wireName: 'Scan1',
      channelNumbers: [3, 4],
      listIndex: 1,
    });
    expect(rec[0x0b]).toBe(3);
    expect(rec[0x0d]).toBe(50);
    expect((rec[0x0c]! >> 2) & 0x03).toBe(1); // current
    expect(rec[0x1a] | (rec[0x1b]! << 8)).toBe(3);
    expect(rec[0x1c] | (rec[0x1d]! << 8)).toBe(4);
  });

  it('counts three named members as four including the current channel', () => {
    const rec = encodeDm32ScanList({
      wireName: 'Three',
      channelNumbers: [10, 11, 12],
      listIndex: 1,
    });
    expect(rec[0x0b]).toBe(4);
    expect(rec[0x0d]).toBe(50);
    expect(rec[0x1a] | (rec[0x1b]! << 8)).toBe(10);
    expect(rec[0x1c] | (rec[0x1d]! << 8)).toBe(11);
    expect(rec[0x1e] | (rec[0x1f]! << 8)).toBe(12);
  });

  it('stores fifteen named members and writes count 16', () => {
    const channelNumbers = Array.from({ length: 15 }, (_, i) => i + 1);
    const rec = encodeDm32ScanList({
      wireName: 'Full',
      channelNumbers,
      listIndex: 1,
    });
    expect(rec[0x0b]).toBe(16);
    expect(rec[0x0d]).toBe(50);
    expect(rec.length).toBe(57);
    for (let i = 0; i < 15; i++) {
      const off = 0x1a + i * 2;
      expect(rec[off]! | (rec[off + 1]! << 8)).toBe(channelNumbers[i]);
    }
    // 15 u16s end at +0x37. The leftover byte is not a 16th member.
    expect(rec[0x38]).toBe(0x00);
  });

  it('keeps an empty projected list at count 0 and hang time 50', () => {
    const rec = encodeDm32ScanList({
      wireName: 'Empty',
      channelNumbers: [],
      listIndex: 1,
    });
    expect(rec[0x0b]).toBe(0);
    expect(rec[0x0d]).toBe(50);
  });
});

describe('encodeScanListsIntoDm32Image', () => {
  it('clears prior scan list when count shrinks', () => {
    const scanData = makeBlock(DM32_METADATA.SCAN_LIST);
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.set(0, scanData);
    const ctx = { addressBase: 0, discovered: [{ address: 0, metadata: DM32_METADATA.SCAN_LIST }] };

    encodeScanListsIntoDm32Image(image, ctx, [
      { wireName: 'First', channelNumbers: [1], listIndex: 1 },
      { wireName: 'Second', channelNumbers: [2], listIndex: 2 },
    ]);
    const secondOff = dm32ScanListEntryOffset(2);
    expect(image.bytes[secondOff]).toBe('S'.charCodeAt(0));

    encodeScanListsIntoDm32Image(image, ctx, [
      { wireName: 'Only', channelNumbers: [5], listIndex: 1 },
    ]);
    expect(image.bytes[dm32ScanListEntryOffset(1)]).toBe('O'.charCodeAt(0));
    expect(image.bytes[secondOff]).toBe(0x00);
    expect(image.bytes[secondOff + 0x0b]).toBe(0x00);
    expect(image.bytes[0]).toBe(1);
  });

  it('clears vacant slots beyond count so member byte is not 0xFF', () => {
    const scanData = makeBlock(DM32_METADATA.SCAN_LIST);
    const image = createMemoryMap(DM32_BLOCK_SIZE);
    image.set(0, scanData);
    const ctx = { addressBase: 0, discovered: [{ address: 0, metadata: DM32_METADATA.SCAN_LIST }] };
    const lists = Array.from({ length: 13 }, (_, i) => ({
      wireName: `L${i + 1}`,
      channelNumbers: [i + 1],
      listIndex: i + 1,
    }));
    encodeScanListsIntoDm32Image(image, ctx, lists);
    expect(image.bytes[0]).toBe(13);
    const vacantOff = dm32ScanListEntryOffset(14);
    expect(image.bytes[vacantOff + 0x0b]).toBe(0x00);
    expect(image.bytes[vacantOff]).toBe(0x00);
  });

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

import { describe, expect, it } from 'vitest';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from './constants.ts';
import {
  DM32_EMPTY_WRITE_CACHE_MESSAGE,
  encodeDm32uvWriteImageFromDownloadCache,
} from './hydration.ts';
import type { Dm32DownloadCache } from './protocol.ts';
import type { RadioChannelDto } from '../../radioChannelDto.ts';

function makeBlock(metadata: number, mutate?: (b: Uint8Array) => void): Uint8Array {
  const b = new Uint8Array(DM32_BLOCK_SIZE);
  b.fill(0xff);
  b[DM32_METADATA_OFFSET] = metadata;
  mutate?.(b);
  return b;
}

function analogChannel(): RadioChannelDto {
  return {
    slotIndex: 1,
    empty: false,
    wireName: 'LIVE',
    rxHz: 145_500_000,
    txHz: 145_500_000,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'FM',
  };
}

describe('encodeDm32uvWriteImageFromDownloadCache', () => {
  it('overlays onto live block contents, not an empty cache', () => {
    const channelBlock = makeBlock(DM32_METADATA.CHANNEL_FIRST, (b) => {
      b[0] = 1;
      b[1] = 0;
    });
    const settingsBlock = makeBlock(DM32_METADATA.VFO_SETTINGS, (b) => {
      b[0] = 0x42;
    });
    const cache: Dm32DownloadCache = {
      addressBase: 0x1000,
      mapSize: DM32_BLOCK_SIZE * 2,
      discovered: [
        { address: 0x1000, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
      ],
      blocks: new Map([
        [0x1000, channelBlock],
        [0x2000, settingsBlock],
      ]),
    };

    const image = encodeDm32uvWriteImageFromDownloadCache(cache, [analogChannel()]);
    expect(image.bytes[DM32_BLOCK_SIZE]).toBe(0x42);
    expect(image.bytes[DM32_BLOCK_SIZE + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.VFO_SETTINGS);
  });

  it('leaves settings tag 0x04 byte +0xB0 unchanged and writes no scan-list records', () => {
    const channelBlock = makeBlock(DM32_METADATA.CHANNEL_FIRST, (b) => {
      b[0] = 1;
    });
    const settingsBlock = makeBlock(DM32_METADATA.VFO_SETTINGS, (b) => {
      b[0xb0] = 0xa5;
    });
    const scanBlock = makeBlock(DM32_METADATA.SCAN_LIST, (b) => {
      b[0] = 2;
    });
    const cache: Dm32DownloadCache = {
      addressBase: 0x1000,
      mapSize: DM32_BLOCK_SIZE * 3,
      discovered: [
        { address: 0x1000, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
        { address: 0x3000, metadata: DM32_METADATA.SCAN_LIST, type: 'scan' },
      ],
      blocks: new Map([
        [0x1000, channelBlock],
        [0x2000, settingsBlock],
        [0x3000, scanBlock],
      ]),
    };
    const image = encodeDm32uvWriteImageFromDownloadCache(cache, [analogChannel()], {
      scanLists: [],
    });
    expect(image.bytes[DM32_BLOCK_SIZE + 0xb0]).toBe(0xa5);
    expect(image.bytes[DM32_BLOCK_SIZE * 2]).toBe(0);
    expect(image.bytes[DM32_BLOCK_SIZE + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.VFO_SETTINGS);
  });

  it('refuses when the download cache has no content blocks', () => {
    expect(() =>
      encodeDm32uvWriteImageFromDownloadCache(
        { addressBase: 0, mapSize: DM32_BLOCK_SIZE, discovered: [], blocks: new Map() },
        [analogChannel()],
      ),
    ).toThrow(DM32_EMPTY_WRITE_CACHE_MESSAGE);
  });

  it('allocates V-frame address-book blocks outside the config window', () => {
    const channelBlock = makeBlock(DM32_METADATA.CHANNEL_FIRST, (b) => {
      b[0] = 1;
      b[1] = 0;
    });
    const cache: Dm32DownloadCache = {
      addressBase: 0x1000,
      mapSize: DM32_BLOCK_SIZE * 2,
      discovered: [{ address: 0x1000, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' }],
      blocks: new Map([[0x1000, channelBlock]]),
      contactsBase: 0x4000,
    };
    const image = encodeDm32uvWriteImageFromDownloadCache(cache, [analogChannel()], {
      digitalContacts: [
        {
          wireName: 'Dir',
          digitalId: 4242,
          callsign: 'D1',
          city: '',
          province: '',
          country: '',
          remark: '',
        },
      ],
    });
    expect(cache.contactWriteAddresses).toEqual([0x4000]);
    expect(cache.blocks.has(0x4000)).toBe(true);
    const off = 0x4000 - cache.addressBase;
    expect(image.bytes[off] | (image.bytes[off + 1]! << 8)).toBe(1);
    expect(image.bytes[off + 0x10]).toBe('D'.charCodeAt(0));
  });

  it('records a claimed zone page without inserting it into sparse blocks', () => {
    const zone = makeBlock(DM32_METADATA.ZONE);
    const calibration = makeBlock(DM32_METADATA.CALIBRATION, (b) => {
      b[0] = 0x22;
    });
    const cache: Dm32DownloadCache = {
      addressBase: 0x1000,
      mapSize: DM32_BLOCK_SIZE * 3,
      discovered: [
        { address: 0x1000, metadata: DM32_METADATA.ZONE, type: 'zone' },
        { address: 0x2000, metadata: DM32_METADATA.CALIBRATION, type: 'calibration' },
        { address: 0x3000, metadata: DM32_METADATA.EMPTY, type: 'empty' },
      ],
      blocks: new Map([
        [0x1000, zone],
        [0x2000, calibration],
      ]),
    };
    const projectedZones = Array.from({ length: 29 }, (_, i) => ({
      wireName: `Z${i + 1}`,
      channelNumbers: [1],
    }));
    const image = encodeDm32uvWriteImageFromDownloadCache(cache, [analogChannel()], {
      zones: projectedZones,
    });
    expect(cache.zoneWriteAddresses).toEqual([0x3000]);
    expect(cache.blocks.has(0x3000)).toBe(false);
    const claimedOff = 0x3000 - cache.addressBase;
    expect(image.bytes[claimedOff + DM32_METADATA_OFFSET]).toBe(0x5d);
    expect(image.bytes[claimedOff]).toBe('Z'.charCodeAt(0));
    expect(image.bytes[DM32_BLOCK_SIZE]).toBe(0x22);
    expect(image.bytes[DM32_BLOCK_SIZE + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.CALIBRATION);
  });
});

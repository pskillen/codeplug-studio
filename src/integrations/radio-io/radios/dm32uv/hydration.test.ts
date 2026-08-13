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

  it('refuses when the download cache has no content blocks', () => {
    expect(() =>
      encodeDm32uvWriteImageFromDownloadCache(
        { addressBase: 0, mapSize: DM32_BLOCK_SIZE, discovered: [], blocks: new Map() },
        [analogChannel()],
      ),
    ).toThrow(DM32_EMPTY_WRITE_CACHE_MESSAGE);
  });
});

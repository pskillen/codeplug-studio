import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../kit/memoryMap.ts';
import { D890_MAP } from '../radios/at-d890uv/constants.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from '../radios/dm32uv/constants.ts';
import {
  OPENUV380_FLASH_SPANS,
  OPENUV380_IMAGE_SIZE,
  openUv380AbsToOffset,
} from '../radios/opengd77/constants.ts';
import { UV5R_MINI_LAYOUT } from '../radios/uv17pro-family/layout.ts';
import { memoryMapFromBackupRegions, regionsFromDownload } from './regionsFromDownload.ts';

describe('regionsFromDownload', () => {
  it('packs UV-5R Mini as three named MEM regions (packed offsets)', () => {
    const image = createMemoryMap(UV5R_MINI_LAYOUT.memTotal);
    image.fill(0, UV5R_MINI_LAYOUT.memTotal, 0xaa);
    const extract = regionsFromDownload({ modelId: 'UV5R-Mini', image });
    expect(extract.coverage).toBe('full-clone');
    expect(extract.regions).toHaveLength(3);
    expect(extract.regions.map((r) => r.id)).toEqual(['mem-0', 'mem-1', 'mem-2']);
    expect(extract.regions.every((r) => r.restoreRole === 'restorable')).toBe(true);
    expect(extract.regionBytes['mem-0']!.byteLength).toBe(UV5R_MINI_LAYOUT.memSizes[0]);
  });

  it('packs OpenGD77 FLASH spans as restorable named bins', () => {
    const image = createMemoryMap(OPENUV380_IMAGE_SIZE);
    image.fill(0, OPENUV380_IMAGE_SIZE, 0xff);
    for (const span of OPENUV380_FLASH_SPANS) {
      const off = openUv380AbsToOffset(span.start);
      image.fill(off, span.length, 0x11);
    }
    const extract = regionsFromDownload({ modelId: 'DM-1701', image });
    expect(extract.coverage).toBe('known-map-regions');
    expect(extract.regions).toHaveLength(OPENUV380_FLASH_SPANS.length);
    expect(extract.regions.every((r) => r.restoreRole === 'restorable')).toBe(true);
    expect(extract.regions[0]!.address).toBe(OPENUV380_FLASH_SPANS[0]!.start);
  });

  it('marks D890 LocalInfo as inspect-only and coalesces sparse cache blocks', () => {
    const local = new Uint8Array(D890_MAP.LocalInfoLength).fill(0x42);
    const channels = new Uint8Array(32).fill(0x21);
    const image = createMemoryMap(0x1000);
    const extract = regionsFromDownload({
      modelId: 'AT-D890UV',
      image,
      sparseBlocks: [
        { address: D890_MAP.ChannelData, data: channels.subarray(0, 16) },
        { address: D890_MAP.ChannelData + 16, data: channels.subarray(16, 32) },
        { address: D890_MAP.LocalInfo, data: local },
      ],
    });
    expect(extract.coverage).toBe('known-map-regions');
    const localRegion = extract.regions.find((r) => r.id === 'local-info');
    expect(localRegion?.restoreRole).toBe('inspect-only');
    const channelRegion = extract.regions.find((r) => r.id === 'channel-data');
    expect(channelRegion?.byteLength).toBe(32);
    expect(channelRegion?.restoreRole).toBe('restorable');
  });

  it('marks D890 optional settings restorable and alarm inspect-only', () => {
    const image = createMemoryMap(0x10);
    const extract = regionsFromDownload({
      modelId: 'AT-D890UV',
      image,
      sparseBlocks: [
        {
          address: D890_MAP.OptionalSettingsMain,
          data: new Uint8Array(D890_MAP.OptionalSettingsMainLength).fill(0x11),
        },
        {
          address: D890_MAP.AlarmBitmap,
          data: new Uint8Array(D890_MAP.AlarmBitmapLength).fill(0x22),
        },
      ],
    });
    expect(extract.regions.find((r) => r.id === 'optional-settings-main')?.restoreRole).toBe(
      'restorable',
    );
    expect(extract.regions.find((r) => r.id === 'alarm-bitmap')?.restoreRole).toBe('inspect-only');
  });

  it('marks DM-32 calibration blocks inspect-only and sets factory-reset fragility', () => {
    const cal = new Uint8Array(DM32_BLOCK_SIZE).fill(0x00);
    cal[DM32_BLOCK_SIZE - 1] = DM32_METADATA.CALIBRATION;
    const zone = new Uint8Array(DM32_BLOCK_SIZE).fill(0x11);
    zone[DM32_BLOCK_SIZE - 1] = 0x5c;
    const image = createMemoryMap(DM32_BLOCK_SIZE * 2);
    const extract = regionsFromDownload({
      modelId: 'DM-32UV',
      image,
      sparseBlocks: [
        { address: 0x1000, data: zone },
        { address: 0x2000, data: cal },
      ],
      addressBase: 0x1000,
    });
    expect(extract.restoreFragileAfterFactoryReset).toBe(true);
    expect(extract.addressBase).toBe(0x1000);
    const calRegion = extract.regions.find((r) => r.restoreRole === 'inspect-only');
    expect(calRegion?.address).toBe(0x2000);
    expect(extract.regions.find((r) => r.address === 0x1000)?.restoreRole).toBe('restorable');
  });
});

describe('memoryMapFromBackupRegions', () => {
  it('round-trips packed UV-5R MEM bins onto a contiguous image', () => {
    const image = createMemoryMap(UV5R_MINI_LAYOUT.memTotal);
    image.fill(0, 0x10, 0xab);
    const extract = regionsFromDownload({ modelId: 'UV5R-Mini', image });
    const rebuilt = memoryMapFromBackupRegions(
      extract.imageByteLength,
      extract.regions,
      extract.regionBytes,
    );
    expect(rebuilt.get(0, 0x10)).toEqual(image.get(0, 0x10));
  });
});

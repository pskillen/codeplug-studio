import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import { makeEmptyBlock, makeFirstChannelBlock } from './__fixtures__/scriptedPipe.ts';
import { remapDm32BlocksByMetadata, remapDm32MemoryMapByTranslations } from './remap.ts';

describe('remapDm32BlocksByMetadata', () => {
  it('remaps ZONE and VFO when live addresses moved; SCAN unchanged is identity', () => {
    const zoneOld = 0x77000;
    const vfoOld = 0x86000;
    const scanAddr = 0x62000;
    const zoneNew = 0x6b000;
    const vfoNew = 0x63000;

    const zoneBlock = makeEmptyBlock(DM32_METADATA.ZONE);
    zoneBlock[0] = 0x5a;
    const vfoBlock = makeEmptyBlock(DM32_METADATA.VFO_SETTINGS);
    vfoBlock[0] = 0x56;
    const scanBlock = makeEmptyBlock(DM32_METADATA.SCAN_LIST);
    scanBlock[0] = 0x53;

    const seededBlocks = new Map([
      [zoneOld, zoneBlock],
      [vfoOld, vfoBlock],
      [scanAddr, scanBlock],
    ]);
    const seededDiscovered = [
      { address: zoneOld, metadata: DM32_METADATA.ZONE, type: 'zone' as const },
      { address: vfoOld, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' as const },
      { address: scanAddr, metadata: DM32_METADATA.SCAN_LIST, type: 'scan' as const },
    ];
    const liveDiscovered = [
      { address: zoneNew, metadata: DM32_METADATA.ZONE, type: 'zone' as const },
      { address: vfoNew, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' as const },
      { address: scanAddr, metadata: DM32_METADATA.SCAN_LIST, type: 'scan' as const },
    ];

    const result = remapDm32BlocksByMetadata(seededBlocks, seededDiscovered, liveDiscovered);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.translations).toEqual([
      { from: zoneOld, to: zoneNew, metadata: DM32_METADATA.ZONE },
      { from: vfoOld, to: vfoNew, metadata: DM32_METADATA.VFO_SETTINGS },
    ]);
    expect(result.blocks.get(zoneNew)?.[0]).toBe(0x5a);
    expect(result.blocks.get(vfoNew)?.[0]).toBe(0x56);
    expect(result.blocks.get(scanAddr)?.[0]).toBe(0x53);
    expect(result.discovered.map((b) => b.address).sort((a, b) => a - b)).toEqual([
      scanAddr,
      vfoNew,
      zoneNew,
    ]);
  });

  it('is a no-op when addresses already match', () => {
    const addr = 0x62000;
    const block = makeEmptyBlock(DM32_METADATA.SCAN_LIST);
    const seededBlocks = new Map([[addr, block]]);
    const discovered = [
      { address: addr, metadata: DM32_METADATA.SCAN_LIST, type: 'scan' as const },
    ];

    const result = remapDm32BlocksByMetadata(seededBlocks, discovered, discovered);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.translations).toEqual([]);
    expect(result.blocks.get(addr)).toEqual(block);
  });

  it('refuses when a required tag is missing from the live map', () => {
    const zoneOld = 0x77000;
    const zoneBlock = makeEmptyBlock(DM32_METADATA.ZONE);
    const seededBlocks = new Map([[zoneOld, zoneBlock]]);
    const seededDiscovered = [
      { address: zoneOld, metadata: DM32_METADATA.ZONE, type: 'zone' as const },
    ];
    const liveDiscovered = [
      { address: 0x62000, metadata: DM32_METADATA.SCAN_LIST, type: 'scan' as const },
    ];

    const result = remapDm32BlocksByMetadata(seededBlocks, seededDiscovered, liveDiscovered);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.missing).toEqual([{ metadata: DM32_METADATA.ZONE, seededAddress: zoneOld }]);
  });

  it('matches multiple channel blocks by metadata in address order', () => {
    const ch1Old = 0x50000;
    const ch2Old = 0x51000;
    const ch1New = 0x60000;
    const ch2New = 0x61000;
    const block1 = makeFirstChannelBlock(1);
    const block2 = makeEmptyBlock(0x13);

    const seededBlocks = new Map([
      [ch1Old, block1],
      [ch2Old, block2],
    ]);
    const seededDiscovered = [
      { address: ch1Old, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' as const },
      { address: ch2Old, metadata: 0x13, type: 'channel' as const },
    ];
    const liveDiscovered = [
      { address: ch1New, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' as const },
      { address: ch2New, metadata: 0x13, type: 'channel' as const },
    ];

    const result = remapDm32BlocksByMetadata(seededBlocks, seededDiscovered, liveDiscovered);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.blocks.get(ch1New)).toEqual(block1);
    expect(result.blocks.get(ch2New)).toEqual(block2);
  });
});

describe('remapDm32MemoryMapByTranslations', () => {
  it('copies translated blocks onto the live MemoryMap window', () => {
    const oldBase = 0x60000;
    const newBase = 0x60000;
    const mapSize = DM32_BLOCK_SIZE * 4;
    const zoneOld = 0x62000;
    const zoneNew = 0x63000;

    const image = createMemoryMap(mapSize);
    image.fill(0, mapSize, 0xff);
    const zonePayload = makeEmptyBlock(DM32_METADATA.ZONE);
    zonePayload[1] = 0xab;
    image.set(zoneOld - oldBase, zonePayload);

    const remapped = remapDm32MemoryMapByTranslations(
      image,
      oldBase,
      newBase,
      mapSize,
      [{ from: zoneOld, to: zoneNew, metadata: DM32_METADATA.ZONE }],
      [zoneNew],
    );

    const newOffset = zoneNew - newBase;
    expect(remapped.get(newOffset, DM32_BLOCK_SIZE)[1]).toBe(0xab);
    expect(remapped.get(newOffset + DM32_BLOCK_SIZE - 1, 1)[0]).toBe(DM32_METADATA.ZONE);
  });
});

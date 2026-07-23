import { describe, expect, it } from 'vitest';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import { classifyDm32Metadata, selectBlocksToBulkRead } from './memory.ts';
import { Dm32uvProtocol } from './protocol.ts';
import { Dm32ScriptedPipe, scriptDm32DownloadTwoBlocks } from './__fixtures__/scriptedPipe.ts';

describe('classifyDm32Metadata', () => {
  it('maps channel / settings / discovery emergency tags', () => {
    expect(classifyDm32Metadata(0x12)).toBe('channel');
    expect(classifyDm32Metadata(0x04)).toBe('vfo');
    expect(classifyDm32Metadata(0x03)).toBe('digitalemergency');
    expect(classifyDm32Metadata(0x10)).toBe('analogemergency');
    expect(classifyDm32Metadata(0xff)).toBe('empty');
  });
});

describe('selectBlocksToBulkRead', () => {
  it('includes first channel block and required settings metadata', () => {
    const selected = selectBlocksToBulkRead(
      [
        { address: 0x1000, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
        { address: 0x3000, metadata: 0x00, type: 'empty' },
      ],
      1,
    );
    expect(selected.map((b) => b.address)).toEqual([0x1000, 0x2000]);
  });
});

describe('Dm32uvProtocol', () => {
  it('connects, discovers, and downloads required blocks into a MemoryMap', async () => {
    const pipe = new Dm32ScriptedPipe();
    const { start, channelBlock, settingsBlock } = scriptDm32DownloadTwoBlocks(pipe, 1);

    const radio = new Dm32uvProtocol();
    const ident = await radio.connect(pipe, { settleScale: 0 });
    expect(ident.modelHints).toContain('DM-32UV');
    expect(ident.firmwareHint).toMatch(/DM32/);

    const image = await radio.download({});
    expect(image.size).toBe(DM32_BLOCK_SIZE * 2);
    expect(image.get(0, DM32_BLOCK_SIZE)).toEqual(channelBlock);
    expect(image.get(DM32_BLOCK_SIZE, DM32_BLOCK_SIZE)).toEqual(settingsBlock);
    expect(image.bytes[DM32_BLOCK_SIZE + 0xfff]).toBe(DM32_METADATA.VFO_SETTINGS);

    const cache = radio.getDownloadCache();
    expect(cache?.addressBase).toBe(start);
    expect(cache?.blocks.size).toBe(2);
    expect(radio.readFirmware(image)).toMatch(/DM32/);
  });

  it('rejects wrong model on PSEARCH', async () => {
    const pipe = new Dm32ScriptedPipe();
    const psearch = new Uint8Array(8);
    psearch[0] = 0x06;
    psearch.set(new TextEncoder().encode('UV5RMIN'), 1);
    pipe.enqueue(psearch);

    const radio = new Dm32uvProtocol();
    await expect(radio.connect(pipe, { settleScale: 0 })).rejects.toThrow(/Unsupported radio model/);
  });
});

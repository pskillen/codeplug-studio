import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import { classifyDm32Metadata, selectBlocksToBulkRead } from './memory.ts';
import { Dm32uvProtocol } from './protocol.ts';
import {
  Dm32ScriptedPipe,
  enqueueVFrame,
  makeEmptyBlock,
  makeFirstChannelBlock,
  scriptDm32DownloadTwoBlocks,
} from './__fixtures__/scriptedPipe.ts';

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
    await expect(radio.connect(pipe, { settleScale: 0 })).rejects.toThrow(
      /Unsupported radio model/,
    );
  });

  it('uploads sparse blocks after seeding hydration without a same-session download', async () => {
    // Regression: connect alone leaves cache.blocks empty; Write must seed from
    // prior Read hydration or upload no-ops and the progress modal vanishes.
    const pipe = new Dm32ScriptedPipe();
    const start = 0x1000;
    const end = 0x2fff;
    const channelBlock = makeFirstChannelBlock(1);
    channelBlock[2] = 0xaa;
    const settingsBlock = makeEmptyBlock(DM32_METADATA.VFO_SETTINGS);

    const psearch = new Uint8Array(8);
    psearch[0] = 0x06;
    psearch.set(new TextEncoder().encode('DP570UV'), 1);
    pipe.enqueue(psearch);
    pipe.enqueue(new Uint8Array([0x50, 0x00, 0x00]));
    pipe.enqueue(new Uint8Array([0x06]));

    const layout = new Uint8Array(8);
    layout.set(new Uint8Array([0x00, 0x10, 0x00, 0x00]), 0); // start 0x1000 LE
    layout.set(new Uint8Array([0xff, 0x2f, 0x00, 0x00]), 4); // end 0x2fff LE
    const firmware = new TextEncoder().encode('DM32.TEST.001\0');
    for (const id of [
      0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0d, 0x0e, 0x0f, 0x10,
    ]) {
      if (id === 0x0a) enqueueVFrame(pipe, id, layout);
      else if (id === 0x01) enqueueVFrame(pipe, id, firmware);
      else enqueueVFrame(pipe, id, new Uint8Array(0));
    }
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array(8).fill(0xff));
    pipe.enqueue(new Uint8Array([0x06]));
    // Two write ACKs
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));

    const radio = new Dm32uvProtocol();
    await radio.connect(pipe, { settleScale: 0 });
    expect(radio.getDownloadCache()?.blocks.size).toBe(0);

    radio.seedDownloadCache({
      addressBase: start,
      mapSize: DM32_BLOCK_SIZE * 2,
      discovered: [
        { address: start, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
      ],
      blocks: new Map([
        [start, channelBlock],
        [0x2000, settingsBlock],
      ]),
    });

    const image = createMemoryMap(DM32_BLOCK_SIZE * 2);
    image.fill(0, DM32_BLOCK_SIZE * 2, 0xff);
    image.set(0, channelBlock);
    image.set(DM32_BLOCK_SIZE, settingsBlock);

    await radio.upload(image, {});

    const writeFrames = pipe.writes.filter(
      (w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE,
    );
    expect(writeFrames).toHaveLength(2);
    expect(writeFrames[0]![1]).toBe(start & 0xff);
    expect(writeFrames[0]![6 + 2]).toBe(0xaa);
    void end;
  });
});

import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA } from './constants.ts';
import {
  classifyDm32Metadata,
  dm32HydrationAddressMismatches,
  groupDm32BlocksForProgress,
  selectBlocksToBulkRead,
} from './memory.ts';
import { Dm32uvProtocol } from './protocol.ts';
import {
  Dm32ScriptedPipe,
  enqueueReadReply,
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

describe('groupDm32BlocksForProgress', () => {
  it('splits selected blocks into named stage groups', () => {
    const groups = groupDm32BlocksForProgress([
      { address: 0x1000, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
      { address: 0x2000, metadata: DM32_METADATA.ZONE, type: 'zone' },
      { address: 0x3000, metadata: DM32_METADATA.SCAN_LIST, type: 'scan' },
      { address: 0x4000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
    ]);
    expect(groups.map((g) => g.stage)).toEqual([
      'Channels',
      'Zones',
      'Scan lists',
      'Settings & other',
    ]);
    expect(groups[0]!.blocks).toHaveLength(1);
  });
});

describe('dm32HydrationAddressMismatches', () => {
  it('flags when live metadata no longer matches the hydration seed', () => {
    const live = new Map<number, number>([
      [0x77000, 0x00],
      [0x62000, DM32_METADATA.SCAN_LIST],
    ]);
    const mismatches = dm32HydrationAddressMismatches(
      [
        { address: 0x77000, metadata: DM32_METADATA.ZONE },
        { address: 0x62000, metadata: DM32_METADATA.SCAN_LIST },
      ],
      live,
    );
    expect(mismatches).toEqual([{ address: 0x77000, expected: DM32_METADATA.ZONE, live: 0x00 }]);
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

    // Discover live map (metadata at each block in config range)
    enqueueReadReply(pipe, start + 0xfff, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
    enqueueReadReply(pipe, 0x2000 + 0xfff, new Uint8Array([DM32_METADATA.VFO_SETTINGS]));
    // Two write ACKs
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));

    await radio.upload(image, {});

    const writeFrames = pipe.writes.filter(
      (w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE,
    );
    expect(writeFrames).toHaveLength(2);
    expect(writeFrames[0]![1]).toBe(start & 0xff);
    expect(writeFrames[0]![6 + 2]).toBe(0xaa);
    void end;
  });

  it('discovers live map and remaps VFO to a new absolute address before upload', async () => {
    const pipe = new Dm32ScriptedPipe();
    const start = 0x1000;
    const vfoLive = 0x3000;
    const channelBlock = makeFirstChannelBlock(1);
    channelBlock[2] = 0xcc;
    const settingsBlock = makeEmptyBlock(DM32_METADATA.VFO_SETTINGS);
    settingsBlock[3] = 0xdd;

    const psearch = new Uint8Array(8);
    psearch[0] = 0x06;
    psearch.set(new TextEncoder().encode('DP570UV'), 1);
    pipe.enqueue(psearch);
    pipe.enqueue(new Uint8Array([0x50, 0x00, 0x00]));
    pipe.enqueue(new Uint8Array([0x06]));

    const layout = new Uint8Array(8);
    layout.set(new Uint8Array([0x00, 0x10, 0x00, 0x00]), 0); // start 0x1000
    layout.set(new Uint8Array([0xff, 0x3f, 0x00, 0x00]), 4); // end 0x3fff → blocks 0x1000,0x2000,0x3000
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

    const radio = new Dm32uvProtocol();
    await radio.connect(pipe, { settleScale: 0 });

    // Stale hydration: VFO still at 0x2000
    radio.seedDownloadCache({
      addressBase: start,
      mapSize: DM32_BLOCK_SIZE * 3,
      discovered: [
        { address: start, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
      ],
      blocks: new Map([
        [start, channelBlock],
        [0x2000, settingsBlock],
      ]),
    });

    const image = createMemoryMap(DM32_BLOCK_SIZE * 3);
    image.fill(0, DM32_BLOCK_SIZE * 3, 0xff);
    image.set(0, channelBlock);
    image.set(DM32_BLOCK_SIZE, settingsBlock);

    // Live discover: channel at 0x1000, empty at 0x2000, VFO moved to 0x3000
    enqueueReadReply(pipe, start + 0xfff, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
    enqueueReadReply(pipe, 0x2000 + 0xfff, new Uint8Array([DM32_METADATA.EMPTY]));
    enqueueReadReply(pipe, vfoLive + 0xfff, new Uint8Array([DM32_METADATA.VFO_SETTINGS]));
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));

    await radio.upload(image, {});

    const writeFrames = pipe.writes.filter(
      (w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE,
    );
    expect(writeFrames).toHaveLength(2);
    const channelWriteAddr =
      writeFrames[0]![1]! | (writeFrames[0]![2]! << 8) | (writeFrames[0]![3]! << 16);
    const vfoWriteAddr =
      writeFrames[1]![1]! | (writeFrames[1]![2]! << 8) | (writeFrames[1]![3]! << 16);
    expect(channelWriteAddr).toBe(start);
    expect(vfoWriteAddr).toBe(vfoLive);
    expect(writeFrames[1]![6 + 3]).toBe(0xdd);
  });

  it('uploads allocated address-book blocks that are outside the config discovery range', async () => {
    const pipe = new Dm32ScriptedPipe();
    const start = 0x1000;
    const contactsBase = 0x4000;
    const channelBlock = makeFirstChannelBlock(1);
    const settingsBlock = makeEmptyBlock(DM32_METADATA.VFO_SETTINGS);
    const contactBlock = makeEmptyBlock(0xff);
    contactBlock[0] = 0xab;

    const psearch = new Uint8Array(8);
    psearch[0] = 0x06;
    psearch.set(new TextEncoder().encode('DP570UV'), 1);
    pipe.enqueue(psearch);
    pipe.enqueue(new Uint8Array([0x50, 0x00, 0x00]));
    pipe.enqueue(new Uint8Array([0x06]));

    const layout = new Uint8Array(8);
    layout.set(new Uint8Array([0x00, 0x10, 0x00, 0x00]), 0);
    layout.set(new Uint8Array([0xff, 0x2f, 0x00, 0x00]), 4);
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

    const radio = new Dm32uvProtocol();
    await radio.connect(pipe, { settleScale: 0 });

    const mapSize = contactsBase - start + DM32_BLOCK_SIZE;
    radio.seedDownloadCache({
      addressBase: start,
      mapSize,
      discovered: [
        { address: start, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
      ],
      blocks: new Map([
        [start, channelBlock],
        [0x2000, settingsBlock],
        [contactsBase, contactBlock],
      ]),
      contactsBase,
      contactWriteAddresses: [contactsBase],
    });

    const image = createMemoryMap(mapSize);
    image.fill(0, mapSize, 0xff);
    image.set(0, channelBlock);
    image.set(DM32_BLOCK_SIZE, settingsBlock);
    image.set(contactsBase - start, contactBlock);

    enqueueReadReply(pipe, start + 0xfff, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
    enqueueReadReply(pipe, 0x2000 + 0xfff, new Uint8Array([DM32_METADATA.VFO_SETTINGS]));
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));

    await radio.upload(image, {});

    const writeFrames = pipe.writes.filter(
      (w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE,
    );
    const writeAddrs = writeFrames.map((w) => w[1]! | (w[2]! << 8) | (w[3]! << 16) | (w[4]! << 24));
    expect(writeAddrs).toContain(contactsBase);
    const contactWrite = writeFrames.find(
      (w) => (w[1]! | (w[2]! << 8) | (w[3]! << 16)) === contactsBase,
    );
    expect(contactWrite![6]).toBe(0xab);
  });

  it('download with progressStage labels content reads separately from metadata discovery', async () => {
    const pipe = new Dm32ScriptedPipe();
    scriptDm32DownloadTwoBlocks(pipe, 1);
    const radio = new Dm32uvProtocol();
    await radio.connect(pipe, { settleScale: 0 });

    const stages: string[] = [];
    const image = await radio.download({
      progressStage: 'Pre-write read',
      onProgress: (p) => {
        if (p.stage) stages.push(p.stage);
      },
    });

    expect(stages).toContain('Discover memory map');
    expect(stages).toContain('Pre-write read');
    expect(stages.indexOf('Discover memory map')).toBeLessThan(stages.indexOf('Pre-write read'));
    expect(radio.getDownloadCache()?.blocks.size).toBe(2);
    expect(image.size).toBe(DM32_BLOCK_SIZE * 2);
  });
});

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
import { planDm32Stages } from './plannedStages.ts';
import {
  expectEmittedWithinPlan,
  expectEventsFollowPlan,
  stageRecorder,
} from '../../plannedStagesTestKit.ts';
import {
  Dm32ScriptedPipe,
  enqueueReadReply,
  enqueueVFrame,
  makeEmptyBlock,
  makeFirstChannelBlock,
  scriptDm32Connect,
  scriptDm32DownloadTwoBlocks,
} from './__fixtures__/scriptedPipe.ts';

describe('classifyDm32Metadata', () => {
  it('maps channel, settings, and emergency tags', () => {
    expect(classifyDm32Metadata(0x12)).toBe('channel');
    expect(classifyDm32Metadata(0x04)).toBe('vfo');
    expect(classifyDm32Metadata(0x03)).toBe('unknown');
    expect(classifyDm32Metadata(0x10)).toBe('analogemergency');
    expect(classifyDm32Metadata(0xff)).toBe('empty');
  });

  it('maps the zone bank 0x5C–0x64 and leaves neighbours unknown', () => {
    expect(classifyDm32Metadata(DM32_METADATA.ZONE)).toBe('zone');
    expect(classifyDm32Metadata(0x5d)).toBe('zone');
    expect(classifyDm32Metadata(DM32_METADATA.ZONE_PAGE_LAST)).toBe('zone');
    expect(classifyDm32Metadata(0x5b)).toBe('unknown');
    expect(classifyDm32Metadata(0x65)).toBe('unknown');
    expect(classifyDm32Metadata(DM32_METADATA.CALIBRATION)).toBe('calibration');
    expect(classifyDm32Metadata(DM32_METADATA.EMPTY)).toBe('empty');
    expect(classifyDm32Metadata(DM32_METADATA.EMPTY_ALT)).toBe('empty');
    expect(classifyDm32Metadata(DM32_METADATA.VFO_SETTINGS)).toBe('vfo');
    // Talk-group neighbours stay unread until a dump shows their payload.
    expect(classifyDm32Metadata(0x45)).toBe('unknown');
    expect(classifyDm32Metadata(0x46)).toBe('unknown');
    expect(classifyDm32Metadata(0x47)).toBe('unknown');
    expect(classifyDm32Metadata(0x48)).toBe('unknown');
  });
});

const CONFIG_WINDOW = { start: 0x1000, end: 0xc8000 };

describe('selectBlocksToBulkRead', () => {
  it('includes first channel block and required settings metadata', () => {
    const selected = selectBlocksToBulkRead(
      [
        { address: 0x1000, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
        { address: 0x3000, metadata: 0x00, type: 'empty' },
      ],
      1,
      CONFIG_WINDOW,
    );
    expect(selected.map((b) => b.address)).toEqual([0x1000, 0x2000]);
  });

  it('includes an already-present later zone page and omits empty pages', () => {
    const discovered = [
      { address: 0x1000, metadata: DM32_METADATA.ZONE },
      { address: 0x2000, metadata: 0x5d },
      { address: 0x3000, metadata: DM32_METADATA.EMPTY },
      { address: 0x4000, metadata: DM32_METADATA.EMPTY_ALT },
    ].map((block) => ({ ...block, type: classifyDm32Metadata(block.metadata) }));
    const selected = selectBlocksToBulkRead(discovered, 0, CONFIG_WINDOW);
    expect(selected.map((b) => b.address)).toEqual([0x1000, 0x2000]);
    expect(selected.every((b) => b.type === 'zone')).toBe(true);
  });

  it('bulk-reads every in-range 0x02 page and skips fonts and voice outside the window', () => {
    const discovered = [
      { address: 0xb8000, metadata: DM32_METADATA.CALIBRATION },
      { address: 0xc0000, metadata: DM32_METADATA.CALIBRATION },
      { address: 0x105000, metadata: DM32_METADATA.CALIBRATION },
      { address: 0x1000, metadata: DM32_METADATA.CHANNEL_FIRST },
    ].map((block) => ({ ...block, type: classifyDm32Metadata(block.metadata) }));
    const selected = selectBlocksToBulkRead(discovered, 1, CONFIG_WINDOW);
    expect(selected.map((b) => b.address)).toEqual([0x1000, 0xb8000, 0xc0000]);
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

    const rec = stageRecorder();
    await radio.upload(image, { onProgress: rec.onProgress });
    // This scenario seeds the cache instead of reading, so 'Pre-write read' is not emitted here.
    expectEmittedWithinPlan(planDm32Stages('write', {}), rec.stages);
    expect(rec.stages).toContain('Channels');

    const writeFrames = pipe.writes.filter(
      (w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE,
    );
    expect(writeFrames).toHaveLength(2);
    expect(writeFrames[0]![1]).toBe(start & 0xff);
    expect(writeFrames[0]![6 + 2]).toBe(0xaa);
    void end;
  });

  it('drops a tag-0x02 cache block and still writes settings', async () => {
    const pipe = new Dm32ScriptedPipe();
    const start = 0x1000;
    scriptDm32Connect(pipe, { start, end: 0x3fff });
    const radio = new Dm32uvProtocol();
    await radio.connect(pipe, { settleScale: 0 });

    const channelBlock = makeFirstChannelBlock(1);
    const settingsBlock = makeEmptyBlock(DM32_METADATA.VFO_SETTINGS);
    settingsBlock[3] = 0x44;
    const cal = makeEmptyBlock(DM32_METADATA.CALIBRATION);
    cal[0] = 0x99;
    radio.seedDownloadCache({
      addressBase: start,
      mapSize: DM32_BLOCK_SIZE * 3,
      discovered: [
        { address: start, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
        { address: 0x3000, metadata: DM32_METADATA.CALIBRATION, type: 'calibration' },
      ],
      blocks: new Map([
        [start, channelBlock],
        [0x2000, settingsBlock],
        [0x3000, cal],
      ]),
    });
    const image = createMemoryMap(DM32_BLOCK_SIZE * 3);
    image.fill(0, image.size, 0xff);
    image.set(0, channelBlock);
    image.set(DM32_BLOCK_SIZE, settingsBlock);
    image.set(DM32_BLOCK_SIZE * 2, cal);

    enqueueReadReply(pipe, start + 0xfff, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
    enqueueReadReply(pipe, 0x2000 + 0xfff, new Uint8Array([DM32_METADATA.VFO_SETTINGS]));
    enqueueReadReply(pipe, 0x3000 + 0xfff, new Uint8Array([DM32_METADATA.CALIBRATION]));
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));

    await radio.upload(image, {});

    const writeFrames = pipe.writes.filter(
      (frame) => frame[0] === 0x57 && frame.length === 6 + DM32_BLOCK_SIZE,
    );
    expect(writeFrames).toHaveLength(2);
    const addresses = writeFrames.map((frame) => frame[1]! | (frame[2]! << 8) | (frame[3]! << 16));
    expect(addresses).toEqual([start, 0x2000]);
    expect(
      writeFrames.every((frame) => frame[frame.length - 1] !== DM32_METADATA.CALIBRATION),
    ).toBe(true);
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

  async function connectForUpload(end: number): Promise<{
    pipe: Dm32ScriptedPipe;
    radio: Dm32uvProtocol;
  }> {
    const pipe = new Dm32ScriptedPipe();
    const psearch = new Uint8Array(8);
    psearch[0] = 0x06;
    psearch.set(new TextEncoder().encode('DP570UV'), 1);
    pipe.enqueue(psearch);
    pipe.enqueue(new Uint8Array([0x50, 0x00, 0x00]));
    pipe.enqueue(new Uint8Array([0x06]));

    const layout = new Uint8Array(8);
    layout.set(new Uint8Array([0x00, 0x10, 0x00, 0x00]), 0);
    layout[4] = end & 0xff;
    layout[5] = (end >>> 8) & 0xff;
    layout[6] = (end >>> 16) & 0xff;
    layout[7] = (end >>> 24) & 0xff;
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
    return { pipe, radio };
  }

  function fullBlockWrites(pipe: Dm32ScriptedPipe): Uint8Array[] {
    return pipe.writes.filter((w) => w[0] === 0x57 && w.length === 6 + DM32_BLOCK_SIZE);
  }

  it('uploads a claimed free zone page without requiring that tag on the radio', async () => {
    const start = 0x1000;
    const claimedAddr = 0x3000;
    const { pipe, radio } = await connectForUpload(0x3fff);
    const channelBlock = makeFirstChannelBlock(1);
    const zoneBlock = makeEmptyBlock(DM32_METADATA.ZONE);
    const claimedBlock = makeEmptyBlock(0x5d);
    claimedBlock[0] = 0xab;

    radio.seedDownloadCache({
      addressBase: start,
      mapSize: DM32_BLOCK_SIZE * 3,
      discovered: [
        { address: start, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.ZONE, type: 'zone' },
      ],
      blocks: new Map([
        [start, channelBlock],
        [0x2000, zoneBlock],
      ]),
      zoneWriteAddresses: [claimedAddr],
    });

    const image = createMemoryMap(DM32_BLOCK_SIZE * 3);
    image.fill(0, image.size, 0xff);
    image.set(0, channelBlock);
    image.set(DM32_BLOCK_SIZE, zoneBlock);
    image.set(DM32_BLOCK_SIZE * 2, claimedBlock);

    enqueueReadReply(pipe, start + 0xfff, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
    enqueueReadReply(pipe, 0x2000 + 0xfff, new Uint8Array([DM32_METADATA.ZONE]));
    enqueueReadReply(pipe, claimedAddr + 0xfff, new Uint8Array([DM32_METADATA.EMPTY_ALT]));
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));

    await radio.upload(image, {});

    const writeFrames = fullBlockWrites(pipe);
    const writeAddrs = writeFrames.map((w) => w[1]! | (w[2]! << 8) | (w[3]! << 16));
    expect(writeAddrs).toContain(claimedAddr);
    const claimedWrite = writeFrames.find(
      (w) => (w[1]! | (w[2]! << 8) | (w[3]! << 16)) === claimedAddr,
    );
    expect(claimedWrite![6]).toBe(0xab);
    expect(claimedWrite![6 + 0xfff]).toBe(0x5d);
  });

  it('refuses a claimed zone page when the live byte is no longer free', async () => {
    const start = 0x1000;
    const claimedAddr = 0x3000;
    const { pipe, radio } = await connectForUpload(0x3fff);
    const channelBlock = makeFirstChannelBlock(1);
    const zoneBlock = makeEmptyBlock(DM32_METADATA.ZONE);
    const claimedBlock = makeEmptyBlock(0x5d);

    radio.seedDownloadCache({
      addressBase: start,
      mapSize: DM32_BLOCK_SIZE * 3,
      discovered: [
        { address: start, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.ZONE, type: 'zone' },
      ],
      blocks: new Map([
        [start, channelBlock],
        [0x2000, zoneBlock],
      ]),
      zoneWriteAddresses: [claimedAddr],
    });

    const image = createMemoryMap(DM32_BLOCK_SIZE * 3);
    image.fill(0, image.size, 0xff);
    image.set(0, channelBlock);
    image.set(DM32_BLOCK_SIZE, zoneBlock);
    image.set(DM32_BLOCK_SIZE * 2, claimedBlock);

    enqueueReadReply(pipe, start + 0xfff, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
    enqueueReadReply(pipe, 0x2000 + 0xfff, new Uint8Array([DM32_METADATA.ZONE]));
    enqueueReadReply(pipe, claimedAddr + 0xfff, new Uint8Array([DM32_METADATA.CALIBRATION]));

    await expect(radio.upload(image, {})).rejects.toThrow(/not a free page/);
    expect(fullBlockWrites(pipe)).toHaveLength(0);
  });

  it('writes a claimed channel location page and keeps it out of the sparse cache (#1383)', async () => {
    const start = 0x1000;
    const claimedAddr = 0x3000;
    const { pipe, radio } = await connectForUpload(0x3fff);
    const channelBlock = makeFirstChannelBlock(1);
    const settings = makeEmptyBlock(DM32_METADATA.VFO_SETTINGS);
    const locationPage = makeEmptyBlock(0x70);
    locationPage[0] = 0x4d;

    radio.seedDownloadCache({
      addressBase: start,
      mapSize: DM32_BLOCK_SIZE * 3,
      discovered: [
        { address: start, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
        { address: claimedAddr, metadata: 0xff, type: 'empty' },
      ],
      blocks: new Map([
        [start, channelBlock],
        [0x2000, settings],
      ]),
      locationWritePages: [{ address: claimedAddr, tag: 0x70, pageIndex: 0, mode: 'claim' }],
    });

    const image = createMemoryMap(DM32_BLOCK_SIZE * 3);
    image.fill(0, image.size, 0xff);
    image.set(0, channelBlock);
    image.set(DM32_BLOCK_SIZE, settings);
    image.set(DM32_BLOCK_SIZE * 2, locationPage);

    enqueueReadReply(pipe, start + 0xfff, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
    enqueueReadReply(pipe, 0x2000 + 0xfff, new Uint8Array([DM32_METADATA.VFO_SETTINGS]));
    enqueueReadReply(pipe, claimedAddr + 0xfff, new Uint8Array([0xff]));
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));

    await radio.upload(image, {});

    const writeFrames = fullBlockWrites(pipe);
    const page = writeFrames.find((w) => (w[1]! | (w[2]! << 8) | (w[3]! << 16)) === claimedAddr);
    expect(page![6]).toBe(0x4d);
    expect(page![6 + 0xfff]).toBe(0x70);
    expect(radio.getDownloadCache()!.blocks.has(claimedAddr)).toBe(false);
  });

  it('refuses a channel location claim when the tag is already live elsewhere (#1383)', async () => {
    const start = 0x1000;
    const { pipe, radio } = await connectForUpload(0x3fff);
    const channelBlock = makeFirstChannelBlock(1);
    radio.seedDownloadCache({
      addressBase: start,
      mapSize: DM32_BLOCK_SIZE * 3,
      discovered: [{ address: start, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' }],
      blocks: new Map([[start, channelBlock]]),
      locationWritePages: [{ address: 0x3000, tag: 0x70, pageIndex: 0, mode: 'claim' }],
    });
    const image = createMemoryMap(DM32_BLOCK_SIZE * 3);
    image.fill(0, image.size, 0xff);
    image.set(0, channelBlock);

    enqueueReadReply(pipe, start + 0xfff, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
    enqueueReadReply(pipe, 0x2000 + 0xfff, new Uint8Array([0x70]));
    enqueueReadReply(pipe, 0x3000 + 0xfff, new Uint8Array([0xff]));

    await expect(radio.upload(image, {})).rejects.toThrow(/Read the radio again/);
    expect(fullBlockWrites(pipe)).toHaveLength(0);
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

    expectEmittedWithinPlan(planDm32Stages('write', {}), stages);
    expect(stages).toContain('Discover memory map');
    expect(stages).toContain('Pre-write read');
    expect(stages.indexOf('Discover memory map')).toBeLessThan(stages.indexOf('Pre-write read'));
    expect(radio.getDownloadCache()?.blocks.size).toBe(2);
    expect(image.size).toBe(DM32_BLOCK_SIZE * 2);
  });

  it('a full Write (pre-write read, then upload) follows the plan in order (#1393)', async () => {
    const pipe = new Dm32ScriptedPipe();
    const { start } = scriptDm32DownloadTwoBlocks(pipe, 1);
    const radio = new Dm32uvProtocol();
    await radio.connect(pipe, { settleScale: 0 });
    const rec = stageRecorder();
    const image = await radio.download({
      progressStage: 'Pre-write read',
      onProgress: rec.onProgress,
    });
    // The upload discovers the live map again, then writes the two dirty blocks.
    enqueueReadReply(pipe, start + 0xfff, new Uint8Array([DM32_METADATA.CHANNEL_FIRST]));
    enqueueReadReply(pipe, 0x2000 + 0xfff, new Uint8Array([DM32_METADATA.VFO_SETTINGS]));
    pipe.enqueue(new Uint8Array([0x06]));
    pipe.enqueue(new Uint8Array([0x06]));
    await radio.upload(image, { onProgress: rec.onProgress });

    const plan = planDm32Stages('write', {});
    expectEventsFollowPlan(plan, rec.events);
    // The label sequence the verifier saw: discover, read, discover again, then the group writes.
    const runs: string[] = [];
    for (const e of rec.events) {
      if (e.stage && e.cur > 0 && runs[runs.length - 1] !== e.stage) runs.push(e.stage);
    }
    expect(runs).toEqual(expect.arrayContaining(['Pre-write read', 'Channels']));
    const all = rec.events.map((e) => e.stage).filter((l, i, a) => l !== a[i - 1]);
    expect(all.filter((l) => l === 'Discover memory map')).toHaveLength(2);
  });
});

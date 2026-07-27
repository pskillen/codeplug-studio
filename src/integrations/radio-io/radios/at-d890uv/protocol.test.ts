import { describe, expect, it } from 'vitest';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { D890_MAP } from './constants.ts';
import { listWriteChunks, cacheToMemoryMap, applyAtD890WriteImageToCache } from './memory.ts';
import { AtD890uvProtocol } from './protocol.ts';
import {
  AtD890ScriptedPipe,
  scriptAtD890Connect,
  scriptAtD890MinimalDownload,
  scriptAtD890WriteAck,
  scriptAtD890SentinelReads,
  enqueueAtD890ReadReply,
} from './__fixtures__/scriptedPipe.ts';
import { AT_D890_MAP_SIZE, AT_D890_SAFE_SKIP_WRITE_ADDR } from './constants.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import { setBitmapBit } from './bitmap.ts';
import { channelPrimaryAddress, channelSecondaryAddress } from './memory.ts';

describe('AtD890uvProtocol', () => {
  it('connects with PROGRAM→QX and ID890UV ident', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    const radio = new AtD890uvProtocol();
    const ident = await radio.connect(pipe);
    expect(ident.modelHints).toContain('AT-D890UV');
    expect(ident.firmwareHint).toBe('V100');
  });

  it('downloads sparse regions into cache', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890MinimalDownload(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const image = await radio.download({});
    expect(image.size).toBeGreaterThan(0);
    const cache = radio.getDownloadCache();
    expect(cache?.blocks.has(D890_MAP.LocalInfo)).toBe(true);
    expect(cache?.blocks.has(D890_MAP.ChannelSet)).toBe(true);
  });

  it('uploads after seeding hydration and skips safe-skip and LocalInfo', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);

    const channelSet = new Uint8Array(0x200);
    setBitmapBit(channelSet, 0, true);
    const primary = new Uint8Array(0x40);
    primary.set(encodeBcdFrequencyHz(145_520_000), 0);
    const secondary = new Uint8Array(0x40);

    radio.seedDownloadCache({
      blocks: new Map([
        [D890_MAP.LocalInfo, new Uint8Array(D890_MAP.LocalInfoLength).fill(0xaa)],
        [D890_MAP.ChannelSet, channelSet],
        [channelPrimaryAddress(0), primary],
        [channelSecondaryAddress(0), secondary],
        [AT_D890_SAFE_SKIP_WRITE_ADDR, new Uint8Array(0x10)],
      ]),
    });

    const image = cacheToMemoryMap(radio.getDownloadCache()!);
    applyAtD890WriteImageToCache(radio.getDownloadCache()!, image);
    const chunks = listWriteChunks(radio.getDownloadCache()!, AT_D890_SAFE_SKIP_WRITE_ADDR);
    scriptAtD890SentinelReads(pipe);
    scriptAtD890WriteAck(pipe, chunks.length);
    scriptAtD890SentinelReads(pipe);

    await radio.upload(image, {});
    expect(pipe.writes.length).toBeGreaterThan(0);
    const writtenAddrs = pipe.writes
      .filter((w) => w[0] === 0x57)
      .map((w) => (w[1]! << 24) | (w[2]! << 16) | (w[3]! << 8) | w[4]!);
    expect(writtenAddrs).not.toContain(AT_D890_SAFE_SKIP_WRITE_ADDR);
    expect(writtenAddrs.some((a) => a >= D890_MAP.LocalInfo && a < D890_MAP.LocalInfo + 0x100)).toBe(
      false,
    );
  });

  it('sends END on disconnect after connect', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    await radio.disconnect();
    const endWrites = pipe.writes.filter((w) => new TextDecoder().decode(w) === 'END');
    expect(endWrites).toHaveLength(1);
  });

  it('sends END on disconnect after download', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890MinimalDownload(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    await radio.download({});
    await radio.disconnect();
    const endWrites = pipe.writes.filter((w) => new TextDecoder().decode(w) === 'END');
    expect(endWrites).toHaveLength(1);
  });

  it('reads channel bank 1 when ChannelSet bit 128 is set (16-byte cache keys)', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    const local = new Uint8Array(D890_MAP.LocalInfoLength).fill(0xff);
    enqueueAtD890ReadReply(pipe, D890_MAP.LocalInfo, local);
    const channelSet = new Uint8Array(0x200);
    setBitmapBit(channelSet, 128, true);
    enqueueAtD890ReadReply(pipe, D890_MAP.ChannelSet, channelSet);
    const primary = new Uint8Array(0x40);
    primary.set(encodeBcdFrequencyHz(439_425_000), 0);
    const secondary = new Uint8Array(0x40);
    enqueueAtD890ReadReply(pipe, channelPrimaryAddress(128), primary);
    enqueueAtD890ReadReply(pipe, channelSecondaryAddress(128), secondary);
    enqueueAtD890ReadReply(pipe, D890_MAP.ZoneSet, new Uint8Array(0x20));
    enqueueAtD890ReadReply(pipe, D890_MAP.ZoneHide, new Uint8Array(0x20));
    enqueueAtD890ReadReply(pipe, D890_MAP.ZoneAChannel, new Uint8Array(0x200));
    enqueueAtD890ReadReply(pipe, D890_MAP.ZoneBChannel, new Uint8Array(0x200));
    enqueueAtD890ReadReply(pipe, D890_MAP.ScanListSet, new Uint8Array(0x20));
    enqueueAtD890ReadReply(pipe, D890_MAP.TalkgroupSet, new Uint8Array(0x4f0).fill(0xff));
    enqueueAtD890ReadReply(pipe, D890_MAP.ReceiveGroupSet, new Uint8Array(0x10));
    enqueueAtD890ReadReply(pipe, D890_MAP.RadioIdSet, new Uint8Array(0x20));
    enqueueAtD890ReadReply(pipe, D890_MAP.MasterIdData, new Uint8Array(0x40));

    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    await radio.download({});
    const cache = radio.getDownloadCache()!;
    expect(cache.blocks.has(channelPrimaryAddress(128))).toBe(true);
    expect(channelPrimaryAddress(128)).toBe(0x108_0000);
  });

  it('fails upload when post-write sentinel differs from pre-write snapshot', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);

    const channelSet = new Uint8Array(0x200);
    setBitmapBit(channelSet, 0, true);
    radio.seedDownloadCache({
      blocks: new Map([
        [D890_MAP.ChannelSet, channelSet],
        [channelPrimaryAddress(0), new Uint8Array(0x40)],
        [channelSecondaryAddress(0), new Uint8Array(0x40)],
      ]),
    });

    const image = cacheToMemoryMap(radio.getDownloadCache()!);
    applyAtD890WriteImageToCache(radio.getDownloadCache()!, image);
    const chunks = listWriteChunks(radio.getDownloadCache()!);
    const localPre = new Uint8Array(D890_MAP.LocalInfoLength).fill(0x11);
    const localPost = new Uint8Array(D890_MAP.LocalInfoLength).fill(0x22);
    scriptAtD890SentinelReads(pipe, { LocalInfo: localPre });
    scriptAtD890WriteAck(pipe, chunks.length);
    scriptAtD890SentinelReads(pipe, { LocalInfo: localPost });

    await expect(radio.upload(image, {})).rejects.toThrow(/sentinel LocalInfo changed/);
  });

  it('rejects upload without seeded blocks', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890Connect(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const image = createMemoryMap(AT_D890_MAP_SIZE);
    await expect(radio.upload(image, {})).rejects.toThrow(/no sparse blocks/);
  });
});
